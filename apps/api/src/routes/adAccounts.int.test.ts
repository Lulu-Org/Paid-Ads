import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { db } from '../db/prisma';
import { processAdsSync } from '../jobs/adsSync';
import { accountSchedulerId } from '../jobs/schedulers';
import { adsSyncQueue, closeQueues } from '../jobs/queues';
import { decryptToken } from '../lib/tokenCrypto';
import { hashPassword } from '../services/auth';

const OWNER_PASSWORD = 'controlled-owner-password';
const MEMBER_PASSWORD = 'controlled-member-password';

interface ErrorBody {
  error: { code: string };
}

interface ConnectBody {
  data: { authorizeUrl: string };
}

interface ListBody {
  data: Array<{ id: string; platform: string; status: string; tokenEncrypted?: unknown }>;
  meta: { page: number; pageSize: number; total: number };
}

interface SyncRunBody {
  data: { id: string; status: string };
}

interface OverviewBody {
  data: { spend: { value: number }; platforms: Array<{ platform: string; connected: boolean }> };
}

async function login(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return (res.body as { data: { token: string } }).data.token;
}

describe('ad-account routes (int)', () => {
  const app = createApp();
  const workspaceId = randomUUID();
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const ownerEmail = `ads-owner-${workspaceId}@lulu.test`;
  const memberEmail = `ads-member-${workspaceId}@lulu.test`;

  let ownerToken: string;
  let memberToken: string;
  let authorizeUrl: string;
  let state: string;
  let accountId: string;

  const auth = (req: request.Test, token = ownerToken) =>
    req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    await db.workspace.create({ data: { id: workspaceId, name: 'Ad accounts test' } });
    await db.user.create({
      data: {
        id: ownerId,
        workspaceId,
        name: 'Ads Owner',
        email: ownerEmail,
        passwordHash: await hashPassword(OWNER_PASSWORD),
        role: 'owner',
      },
    });
    await db.user.create({
      data: {
        id: memberId,
        workspaceId,
        name: 'Ads Member',
        email: memberEmail,
        passwordHash: await hashPassword(MEMBER_PASSWORD),
        role: 'member',
      },
    });

    ownerToken = await login(app, ownerEmail, OWNER_PASSWORD);
    memberToken = await login(app, memberEmail, MEMBER_PASSWORD);
  }, 180_000);

  afterAll(async () => {
    await db.campaignMetricDay.deleteMany({ where: { workspaceId } });
    await db.campaign.deleteMany({ where: { workspaceId } });
    await db.syncRun.deleteMany({ where: { workspaceId } });
    await db.adAccount.deleteMany({ where: { workspaceId } });
    await db.user.deleteMany({ where: { workspaceId } });
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
    await closeQueues();
  });

  it('requires a token to list accounts', async () => {
    const res = await request(app).get('/api/v1/ad-accounts');
    expect(res.status).toBe(401);
  });

  it('lets a member list accounts but not start a connection', async () => {
    const list = await auth(request(app).get('/api/v1/ad-accounts'), memberToken);
    expect(list.status).toBe(200);
    expect((list.body as ListBody).data).toEqual([]);

    const connect = await auth(request(app).post('/api/v1/ad-accounts/connect'), memberToken).send({
      platform: 'google_ads',
    });
    expect(connect.status).toBe(403);
    expect((connect.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('rejects a callback with an invalid state', async () => {
    const res = await request(app)
      .get('/api/v1/ad-accounts/callback/google_ads')
      .query({ code: 'simulated-google_ads', state: 'not-a-signed-state' });
    expect(res.status).toBe(401);
  });

  it('connects an account through OAuth, encrypts the token, queues the first sync and schedules it', async () => {
    const connect = await auth(request(app).post('/api/v1/ad-accounts/connect')).send({
      platform: 'google_ads',
    });
    expect(connect.status).toBe(200);
    authorizeUrl = (connect.body as ConnectBody).data.authorizeUrl;

    const url = new URL(authorizeUrl);
    expect(url.pathname).toBe('/api/v1/ad-accounts/callback/google_ads');
    state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    expect(state).not.toBe('');

    const callback = await request(app)
      .get('/api/v1/ad-accounts/callback/google_ads')
      .query({ code, state });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(
      'http://localhost:3000/ads/integrations?connected=google_ads',
    );

    const account = await db.adAccount.findFirst({
      where: { workspaceId, platform: 'google_ads' },
    });
    expect(account).not.toBeNull();
    accountId = account!.id;
    expect(account!.status).toBe('connected');
    expect(account!.tokenEncrypted).toMatch(/^v1\./);
    expect(account!.tokenEncrypted).not.toContain('simulated-token');
    expect(decryptToken(account!.tokenEncrypted!)).toBe('simulated-token:google_ads');

    const queued = await db.syncRun.findFirst({
      where: { workspaceId, adAccountId: accountId },
    });
    expect(queued).toMatchObject({ status: 'queued', kind: 'sync' });

    const schedulers = await adsSyncQueue.getJobSchedulers(0, -1, true);
    expect(schedulers.map((scheduler) => scheduler.key)).toContain(accountSchedulerId(accountId));

    const list = await auth(request(app).get('/api/v1/ad-accounts'));
    expect((list.body as ListBody).data).toHaveLength(1);
    expect((list.body as ListBody).data[0]).not.toHaveProperty('tokenEncrypted');
  });

  it('rejects a replayed callback state', async () => {
    const replay = await request(app)
      .get('/api/v1/ad-accounts/callback/google_ads')
      .query({ code: 'simulated-google_ads', state });
    expect(replay.status).toBe(401);
  });

  it('queues a sync and fills the overview with campaigns and spend', async () => {
    const sync = await auth(request(app).post(`/api/v1/ad-accounts/${accountId}/sync`));
    expect(sync.status).toBe(200);
    const syncRun = (sync.body as SyncRunBody).data;
    expect(syncRun.status).toBe('queued');

    const result = await processAdsSync({
      workspaceId,
      adAccountId: accountId,
      syncRunId: syncRun.id,
    });
    expect(result.campaigns).toBe(1);
    expect(result.metricDays).toBeGreaterThan(0);

    const finished = await db.syncRun.findFirst({ where: { id: syncRun.id } });
    expect(finished).toMatchObject({ status: 'succeeded' });
    expect(finished!.recordsProcessed).toBeGreaterThan(0);

    const campaigns = await auth(request(app).get('/api/v1/campaigns'));
    expect(campaigns.status).toBe(200);
    const list = campaigns.body as { data: Array<{ externalId: string; platform: string }> };
    expect(list.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ externalId: 'g_1001' })]),
    );

    const overview = await auth(request(app).get('/api/v1/overview'));
    expect(overview.status).toBe(200);
    const body = overview.body as OverviewBody;
    expect(body.data.spend.value).toBeGreaterThan(0);
    expect(
      body.data.platforms.find((platform) => platform.platform === 'google_ads'),
    ).toMatchObject({ connected: true });
  }, 60_000);

  it('disconnects: clears the token and scopes, removes the scheduler and keeps the row', async () => {
    const res = await auth(request(app).delete(`/api/v1/ad-accounts/${accountId}`));
    expect(res.status).toBe(204);

    const account = await db.adAccount.findFirst({ where: { id: accountId } });
    expect(account).toMatchObject({
      status: 'disconnected',
      tokenEncrypted: null,
      scopes: [],
      lastError: null,
    });

    const schedulers = await adsSyncQueue.getJobSchedulers(0, -1, true);
    expect(schedulers.map((scheduler) => scheduler.key)).not.toContain(
      accountSchedulerId(accountId),
    );

    const sync = await auth(request(app).post(`/api/v1/ad-accounts/${accountId}/sync`));
    expect(sync.status).toBe(409);
  });
});
