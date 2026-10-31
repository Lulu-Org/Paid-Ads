import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../prisma/seed';
import { SEED_JAMIE_ID, SEED_WORKSPACE_ID } from '../../prisma/seed-ids';
import { createApp } from '../app';
import { env } from '../config/env';
import { db } from '../db/prisma';
import { disconnectRedis } from '../lib/redis';
import { hashPassword } from '../services/auth';

process.env.UPLOAD_DIR = tmpdir();

const OWNER = { email: 'jamie.morgan@lulu.test', password: env.SEED_OWNER_PASSWORD };

interface ErrorBody {
  error: { code: string };
}
interface Item {
  id: string;
  name: string;
  approvalStatus?: string;
  approvedById?: string | null;
  fileUrl?: string | null;
  campaignCount?: number;
  health?: string;
  value?: unknown;
}
interface One {
  data: Item;
}
interface List {
  data: Item[];
  meta: { page: number; pageSize: number; total: number };
}

async function login(app: Express, credentials: { email: string; password: string }) {
  const res = await request(app).post('/api/v1/auth/login').send(credentials);
  expect(res.status).toBe(200);
  return (res.body as { data: { token: string } }).data.token;
}

describe('library routes (int)', () => {
  const app = createApp();
  let ownerToken: string;
  let memberToken: string;

  const otherWorkspaceId = randomUUID();
  const memberId = randomUUID();
  const memberEmail = `member-${memberId}@lulu.test`;
  const memberPassword = 'member-test-password';
  const otherAudienceId = randomUUID();
  const otherCreativeId = randomUUID();
  const otherEventId = randomUUID();

  const audienceIds: string[] = [];
  const creativeIds: string[] = [];
  const eventIds: string[] = [];
  const campaignIds: string[] = [];

  const owner = (req: request.Test) => req.set('Authorization', `Bearer ${ownerToken}`);
  const member = (req: request.Test) => req.set('Authorization', `Bearer ${memberToken}`);

  beforeAll(async () => {
    await runSeed();
    ownerToken = await login(app, OWNER);

    await db.workspace.create({ data: { id: otherWorkspaceId, name: 'Other workspace' } });
    await db.user.create({
      data: {
        id: memberId,
        workspaceId: SEED_WORKSPACE_ID,
        name: 'Test Member',
        email: memberEmail,
        passwordHash: await hashPassword(memberPassword),
        role: 'member',
      },
    });
    memberToken = await login(app, { email: memberEmail, password: memberPassword });

    await db.audience.create({
      data: {
        id: otherAudienceId,
        workspaceId: otherWorkspaceId,
        name: 'Other audience',
        source: 'customer_list',
        consentBasis: 'Test',
      },
    });
    await db.creative.create({
      data: { id: otherCreativeId, workspaceId: otherWorkspaceId, name: 'Other creative', type: 'image' },
    });
    await db.conversionEvent.create({
      data: {
        id: otherEventId,
        workspaceId: otherWorkspaceId,
        name: 'Other event',
        source: 'crm',
        platforms: ['google_ads'],
        health: 'mapped',
      },
    });
  }, 180_000);

  afterAll(async () => {
    await db.campaignCreative.deleteMany({ where: { campaignId: { in: campaignIds } } });
    await db.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await db.audience.deleteMany({
      where: { id: { in: [...audienceIds, otherAudienceId] } },
    });
    await db.creative.deleteMany({
      where: { id: { in: [...creativeIds, otherCreativeId] } },
    });
    await db.conversionEvent.deleteMany({
      where: { id: { in: [...eventIds, otherEventId] } },
    });
    await db.user.deleteMany({ where: { id: memberId } });
    await db.workspace.deleteMany({ where: { id: otherWorkspaceId } });
    await db.$disconnect();
    await disconnectRedis();
  });

  describe('audiences', () => {
    it('requires a token', async () => {
      const res = await request(app).get('/api/v1/audiences');
      expect(res.status).toBe(401);
    });

    it('creates, reads, updates, lists and deletes an audience', async () => {
      const created = await owner(request(app).post('/api/v1/audiences')).send({
        name: 'Int test audience',
        source: 'crm_segment',
        consentBasis: 'Marketing consent in CRM',
        platforms: ['google_ads', 'meta_ads'],
      });
      expect(created.status).toBe(201);
      const audience = (created.body as One).data;
      audienceIds.push(audience.id);
      expect(audience).toMatchObject({ campaignCount: 0, syncing: false, matchRate: null });

      const patched = await owner(request(app).patch(`/api/v1/audiences/${audience.id}`)).send({
        name: 'Int test audience renamed',
      });
      expect(patched.status).toBe(200);
      expect((patched.body as One).data.name).toBe('Int test audience renamed');

      const filtered = await owner(
        request(app).get('/api/v1/audiences?platform=meta_ads&q=renamed'),
      );
      expect(filtered.status).toBe(200);
      expect((filtered.body as List).data.map((a) => a.id)).toContain(audience.id);

      const removed = await owner(request(app).delete(`/api/v1/audiences/${audience.id}`));
      expect(removed.status).toBe(204);
      const gone = await owner(request(app).get(`/api/v1/audiences/${audience.id}`));
      expect(gone.status).toBe(404);
    });

    it('rejects an invalid body and an unsupported sort', async () => {
      const bad = await owner(request(app).post('/api/v1/audiences')).send({ name: '' });
      expect(bad.status).toBe(400);
      const sort = await owner(request(app).get('/api/v1/audiences?sort=email'));
      expect(sort.status).toBe(400);
    });

    it('answers 404 for another workspace audience', async () => {
      const get = await owner(request(app).get(`/api/v1/audiences/${otherAudienceId}`));
      expect(get.status).toBe(404);
      expect((get.body as ErrorBody).error.code).toBe('NOT_FOUND');
      const patch = await owner(request(app).patch(`/api/v1/audiences/${otherAudienceId}`)).send({
        name: 'Nope',
      });
      expect(patch.status).toBe(404);
      const del = await owner(request(app).delete(`/api/v1/audiences/${otherAudienceId}`));
      expect(del.status).toBe(404);
    });

    it('lets a member create but not delete', async () => {
      const created = await member(request(app).post('/api/v1/audiences')).send({
        name: 'Member audience',
        source: 'website_visitors',
        consentBasis: 'Cookie consent',
        platforms: ['google_ads'],
      });
      expect(created.status).toBe(201);
      const id = (created.body as One).data.id;
      audienceIds.push(id);
      const del = await member(request(app).delete(`/api/v1/audiences/${id}`));
      expect(del.status).toBe(403);
    });
  });

  describe('creatives', () => {
    it('creates a creative from JSON and approves it as the owner', async () => {
      const created = await owner(request(app).post('/api/v1/creatives')).send({
        name: 'Int test creative',
        type: 'search_ad',
        meta: { headlines: 4 },
      });
      expect(created.status).toBe(201);
      const creative = (created.body as One).data;
      creativeIds.push(creative.id);
      expect(creative.approvalStatus).toBe('pending');

      const approved = await owner(request(app).post(`/api/v1/creatives/${creative.id}/approve`));
      expect(approved.status).toBe(200);
      expect((approved.body as One).data).toMatchObject({
        approvalStatus: 'approved',
        approvedById: SEED_JAMIE_ID,
      });
    });

    it('forbids a member from approving', async () => {
      const created = await member(request(app).post('/api/v1/creatives')).send({
        name: 'Member creative',
        type: 'image',
      });
      expect(created.status).toBe(201);
      const id = (created.body as One).data.id;
      creativeIds.push(id);
      const res = await member(request(app).post(`/api/v1/creatives/${id}/approve`));
      expect(res.status).toBe(403);
    });

    it('accepts a multipart upload and rejects a bad file type', async () => {
      const ok = await owner(
        request(app)
          .post('/api/v1/creatives')
          .field('name', 'Uploaded creative')
          .field('type', 'image')
          .attach('file', Buffer.from('fake-png-bytes'), {
            filename: 'banner.png',
            contentType: 'image/png',
          }),
      );
      expect(ok.status).toBe(201);
      const creative = (ok.body as One).data;
      creativeIds.push(creative.id);
      expect(creative.fileUrl).toContain('/uploads/');

      const bad = await owner(
        request(app)
          .post('/api/v1/creatives')
          .field('name', 'Bad file')
          .field('type', 'image')
          .attach('file', Buffer.from('MZ'), {
            filename: 'virus.exe',
            contentType: 'application/x-msdownload',
          }),
      );
      expect(bad.status).toBe(400);
    });

    it('answers 404 for another workspace creative', async () => {
      const get = await owner(request(app).get(`/api/v1/creatives/${otherCreativeId}`));
      expect(get.status).toBe(404);
      const approve = await owner(request(app).post(`/api/v1/creatives/${otherCreativeId}/approve`));
      expect(approve.status).toBe(404);
    });

    it('lists a creative test with the winner CPL advantage', async () => {
      const a = await owner(request(app).post('/api/v1/creatives')).send({ name: 'Variant A', type: 'image' });
      const b = await owner(request(app).post('/api/v1/creatives')).send({ name: 'Variant B', type: 'image' });
      const creativeA = (a.body as One).data.id;
      const creativeB = (b.body as One).data.id;
      creativeIds.push(creativeA, creativeB);

      const campaignId = randomUUID();
      campaignIds.push(campaignId);
      await db.campaign.create({
        data: {
          id: campaignId,
          workspaceId: SEED_WORKSPACE_ID,
          platform: 'meta_ads',
          name: 'Creative test campaign',
          status: 'draft',
          objective: 'Leads',
          budgetAmount: 1000,
          budgetCurrency: 'EUR',
          ownerId: SEED_JAMIE_ID,
        },
      });
      await db.campaignCreative.createMany({
        data: [
          { workspaceId: SEED_WORKSPACE_ID, campaignId, creativeId: creativeA, variant: 'A', role: 'control', spendAmount: 100, leads: 10 },
          { workspaceId: SEED_WORKSPACE_ID, campaignId, creativeId: creativeB, variant: 'B', role: 'winner', spendAmount: 100, leads: 20 },
        ],
      });

      const res = await owner(request(app).get('/api/v1/creative-tests'));
      expect(res.status).toBe(200);
      const tests = (
        res.body as {
          data: Array<{
            campaignId: string;
            winnerLead: number | null;
            variants: Array<{ variant: string; cpl: { amount: number } | null }>;
          }>;
        }
      ).data;
      const test = tests.find((t) => t.campaignId === campaignId);
      expect(test?.variants.map((v) => [v.variant, v.cpl?.amount])).toEqual([
        ['A', 10],
        ['B', 5],
      ]);
      expect(test?.winnerLead).toBe(0.5);

      const winning = await owner(request(app).get(`/api/v1/creatives/${creativeB}`));
      expect((winning.body as { data: { winning: boolean; campaignCount: number } }).data).toMatchObject({
        winning: true,
        campaignCount: 1,
      });
    });
  });

  describe('conversion events, tracking and attribution', () => {
    it('creates a dynamic-value event that starts as needing attention', async () => {
      const created = await owner(request(app).post('/api/v1/conversion-events')).send({
        name: 'Int test event',
        source: 'website',
        value: null,
        platforms: ['google_ads'],
      });
      expect(created.status).toBe(201);
      const event = (created.body as One).data;
      eventIds.push(event.id);
      expect(event).toMatchObject({ value: null, health: 'needs_attention' });

      const patched = await owner(request(app).patch(`/api/v1/conversion-events/${event.id}`)).send({
        value: { amount: 50, currency: 'EUR' },
      });
      expect(patched.status).toBe(200);
      expect((patched.body as One).data.value).toEqual({ amount: 50, currency: 'EUR' });
    });

    it('answers 404 for another workspace event and 403 for a member delete', async () => {
      const other = await owner(request(app).patch(`/api/v1/conversion-events/${otherEventId}`)).send({
        name: 'Nope',
      });
      expect(other.status).toBe(404);
      const del = await member(request(app).delete(`/api/v1/conversion-events/${eventIds[0]}`));
      expect(del.status).toBe(403);
    });

    it('reports tracking health with at least one event needing attention', async () => {
      const res = await owner(request(app).get('/api/v1/tracking/health'));
      expect(res.status).toBe(200);
      const body = (res.body as { data: { needsAttention: number; eventsToday: number } }).data;
      expect(body.needsAttention).toBeGreaterThanOrEqual(1);
      expect(body.eventsToday).toBeGreaterThanOrEqual(0);
    });

    it('returns attribution for the default model and rejects an unknown one', async () => {
      const res = await owner(request(app).get('/api/v1/attribution'));
      expect(res.status).toBe(200);
      const body = (
        res.body as {
          data: { model: string; dataQuality: number; revenue: { currency: string }; byPlatform: unknown[] };
        }
      ).data;
      expect(body.model).toBe('data_driven');
      expect(body.dataQuality).toBeGreaterThanOrEqual(0);
      expect(body.dataQuality).toBeLessThanOrEqual(1);

      const linear = await owner(request(app).get('/api/v1/attribution?model=linear'));
      expect((linear.body as { data: { model: string } }).data.model).toBe('linear');

      const bad = await owner(request(app).get('/api/v1/attribution?model=magic'));
      expect(bad.status).toBe(400);
    });
  });
});