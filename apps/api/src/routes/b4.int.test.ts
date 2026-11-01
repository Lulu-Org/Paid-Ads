import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runSeed } from '../../prisma/seed';
import { SEED_AD_ACCOUNT_IDS, SEED_JAMIE_ID, SEED_WORKSPACE_ID } from '../../prisma/seed-ids';
import { createApp } from '../app';
import { env } from '../config/env';
import { db } from '../db/prisma';
import { disconnectRedis } from '../lib/redis';
import { hashPassword } from '../services/auth';

const queueMocks = vi.hoisted(() => ({
  enqueueAdsPush: vi.fn().mockResolvedValue({ id: 'job' }),
  enqueueAdsSync: vi.fn().mockResolvedValue({ id: 'job' }),
}));

vi.mock('../jobs/queues', () => queueMocks);

const OWNER = { email: 'jamie.morgan@lulu.test', password: env.SEED_OWNER_PASSWORD };
const PASSWORD = 'b4-test-password';

interface Item {
  id: string;
  status?: string;
  name?: string;
  enabled?: boolean;
  condition?: unknown;
  userId?: string;
  adsRole?: string;
  invited?: boolean;
  canApproveCreatives?: boolean;
}

const data = <T>(res: request.Response): T => (res.body as { data: T }).data;

async function login(app: Express, credentials: { email: string; password: string }) {
  const res = await request(app).post('/api/v1/auth/login').send(credentials);
  expect(res.status).toBe(200);
  return data<{ token: string }>(res).token;
}

describe('B4 routes (int)', () => {
  const app = createApp();
  let ownerToken = '';
  let adminToken = '';
  let memberToken = '';

  const adminId = randomUUID();
  const memberId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const otherUserId = randomUUID();

  const campaignIds: string[] = [];
  const ruleIds: string[] = [];
  const reportIds: string[] = [];
  const teamUserIds: string[] = [];
  const incidentIds: string[] = [];
  const statementIds: string[] = [];
  const otherIds = {
    approval: randomUUID(),
    rule: randomUUID(),
    report: randomUUID(),
    incident: randomUUID(),
    statement: randomUUID(),
    team: randomUUID(),
  };

  const owner = (req: request.Test) => req.set('Authorization', `Bearer ${ownerToken}`);
  const admin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);
  const member = (req: request.Test) => req.set('Authorization', `Bearer ${memberToken}`);

  async function createUser(id: string, role: 'admin' | 'member'): Promise<string> {
    const email = `${role}-${id}@lulu.test`;
    await db.user.create({
      data: {
        id,
        workspaceId: SEED_WORKSPACE_ID,
        name: `Test ${role}`,
        email,
        passwordHash: await hashPassword(PASSWORD),
        role,
      },
    });
    return login(app, { email, password: PASSWORD });
  }

  async function createCampaign(): Promise<string> {
    const id = randomUUID();
    await db.campaign.create({
      data: {
        id,
        workspaceId: SEED_WORKSPACE_ID,
        platform: 'google_ads',
        adAccountId: SEED_AD_ACCOUNT_IDS.googleAds,
        name: `B4 campaign ${id}`,
        status: 'draft',
        objective: 'Leads',
        budgetAmount: 1000,
        budgetCurrency: 'EUR',
        ownerId: SEED_JAMIE_ID,
      },
    });
    campaignIds.push(id);
    return id;
  }

  beforeAll(async () => {
    await runSeed();
    ownerToken = await login(app, OWNER);
    adminToken = await createUser(adminId, 'admin');
    memberToken = await createUser(memberId, 'member');

    await db.workspace.create({ data: { id: otherWorkspaceId, name: 'Other workspace' } });
    await db.user.create({
      data: {
        id: otherUserId,
        workspaceId: otherWorkspaceId,
        name: 'Other Owner',
        email: `other-${otherWorkspaceId}@lulu.test`,
        passwordHash: await hashPassword(PASSWORD),
        role: 'owner',
      },
    });
    await db.approvalRequest.create({
      data: {
        id: otherIds.approval,
        workspaceId: otherWorkspaceId,
        kind: 'creative',
        payload: {},
        requestedById: otherUserId,
      },
    });
    await db.automationRule.create({
      data: {
        id: otherIds.rule,
        workspaceId: otherWorkspaceId,
        name: 'Other rule',
        trigger: { platforms: [], schedule: null },
        action: 'notify',
      },
    });
    await db.report.create({
      data: {
        id: otherIds.report,
        workspaceId: otherWorkspaceId,
        name: 'Other report',
        view: { platforms: [], rangeDays: 30, compare: 'none' },
      },
    });
    await db.incident.create({
      data: {
        id: otherIds.incident,
        workspaceId: otherWorkspaceId,
        platform: 'google_ads',
        kind: 'sync_failed',
        subject: 'Other incident',
      },
    });
    await db.statement.create({
      data: {
        id: otherIds.statement,
        workspaceId: otherWorkspaceId,
        month: '2020-01',
        platform: 'google_ads',
        amountAmount: 1,
        currency: 'EUR',
        status: 'paid',
      },
    });
    await db.teamMember.create({
      data: {
        id: otherIds.team,
        workspaceId: otherWorkspaceId,
        userId: otherUserId,
        adsRole: 'editor',
        channelScope: 'all',
      },
    });
  }, 180_000);

  afterAll(async () => {
    const workspaces = [SEED_WORKSPACE_ID, otherWorkspaceId];
    await db.approvalRequest.deleteMany({
      where: { OR: [{ campaignId: { in: campaignIds } }, { workspaceId: otherWorkspaceId }] },
    });
    await db.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await db.automationRule.deleteMany({
      where: { OR: [{ id: { in: ruleIds } }, { workspaceId: otherWorkspaceId }] },
    });
    await db.report.deleteMany({
      where: { OR: [{ id: { in: reportIds } }, { workspaceId: otherWorkspaceId }] },
    });
    await db.incident.deleteMany({
      where: { OR: [{ id: { in: incidentIds } }, { workspaceId: otherWorkspaceId }] },
    });
    await db.statement.deleteMany({
      where: { OR: [{ id: { in: statementIds } }, { workspaceId: otherWorkspaceId }] },
    });
    await db.teamMember.deleteMany({
      where: { userId: { in: [...teamUserIds, otherUserId] }, workspaceId: { in: workspaces } },
    });
    await db.user.deleteMany({
      where: { id: { in: [adminId, memberId, otherUserId, ...teamUserIds] } },
    });
    await db.workspace.deleteMany({ where: { id: otherWorkspaceId } });
    await db.$disconnect();
    await disconnectRedis();
  });

  describe('approvals', () => {
    it('dedupes an open request and blocks approving your own', async () => {
      const campaignId = await createCampaign();
      const body = {
        kind: 'budget_change',
        campaignId,
        payload: { budget: { amount: 4000, currency: 'EUR' } },
      };
      const first = await owner(request(app).post('/api/v1/approvals')).send(body);
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      const again = await owner(request(app).post('/api/v1/approvals')).send(body);
      expect(again.status).toBe(200);
      expect(data<Item>(again).id).toBe(data<Item>(first).id);

      const own = await owner(
        request(app).post(`/api/v1/approvals/${data<Item>(first).id}/approve`),
      );
      expect(own.status).toBe(403);
    });

    it('lets another approver apply a budget change once', async () => {
      const campaignId = await createCampaign();
      const created = await owner(request(app).post('/api/v1/approvals')).send({
        kind: 'budget_change',
        campaignId,
        payload: { budget: { amount: 4000, currency: 'EUR' } },
      });
      const id = data<Item>(created).id;

      const approved = await admin(request(app).post(`/api/v1/approvals/${id}/approve`));
      expect(approved.status).toBe(200);
      expect(data<Item>(approved).status).toBe('approved');
      const row = await db.campaign.findFirst({ where: { id: campaignId } });
      expect(row?.budgetAmount.toNumber()).toBe(4000);
      expect(queueMocks.enqueueAdsPush).toHaveBeenCalled();

      const twice = await admin(request(app).post(`/api/v1/approvals/${id}/approve`));
      expect(twice.status).toBe(409);
    });

    it('rejects a request, filters the inbox, and checks permissions', async () => {
      const campaignId = await createCampaign();
      const created = await owner(request(app).post('/api/v1/approvals')).send({
        kind: 'launch',
        campaignId,
        payload: {},
      });
      const id = data<Item>(created).id;

      const forbidden = await member(request(app).post(`/api/v1/approvals/${id}/reject`));
      expect(forbidden.status).toBe(403);
      const rejected = await admin(request(app).post(`/api/v1/approvals/${id}/reject`));
      expect(data<Item>(rejected).status).toBe('rejected');

      const list = await owner(request(app).get('/api/v1/approvals?status=rejected'));
      expect(list.status).toBe(200);
      expect(data<Item[]>(list).map((a) => a.id)).toContain(id);
    });

    it('answers 404 for another workspace request', async () => {
      const res = await admin(request(app).post(`/api/v1/approvals/${otherIds.approval}/approve`));
      expect(res.status).toBe(404);
    });
  });

  describe('spend limit and approval policy', () => {
    it('reads, updates and restores the spend limit', async () => {
      const before = data<{
        monthly: { amount: number; currency: string };
        alertAt: number;
        notifyBeforeLimit: boolean;
      }>(await owner(request(app).get('/api/v1/spend-limit')));

      const updated = await owner(request(app).put('/api/v1/spend-limit')).send({
        monthly: { amount: 9000, currency: 'EUR' },
        alertAt: 0.9,
        notifyBeforeLimit: true,
      });
      expect(updated.status).toBe(200);
      expect(
        data<{ monthly: { amount: number }; used: { currency: string } }>(updated),
      ).toMatchObject({
        monthly: { amount: 9000 },
        used: { currency: 'EUR' },
      });

      const badAlert = await owner(request(app).put('/api/v1/spend-limit')).send({
        monthly: { amount: 9000, currency: 'EUR' },
        alertAt: 0.75,
        notifyBeforeLimit: false,
      });
      expect(badAlert.status).toBe(400);

      await owner(request(app).put('/api/v1/spend-limit')).send({
        monthly: before.monthly,
        alertAt: before.alertAt,
        notifyBeforeLimit: before.notifyBeforeLimit,
      });
    });

    it('forbids a member and an editing-less role from billing', async () => {
      expect((await member(request(app).get('/api/v1/spend-limit'))).status).toBe(403);
      expect(
        (
          await member(request(app).put('/api/v1/spend-limit')).send({
            monthly: { amount: 1, currency: 'EUR' },
            alertAt: 0.8,
            notifyBeforeLimit: false,
          })
        ).status,
      ).toBe(403);
    });

    it('returns the approval policy and validates the update', async () => {
      const current = await owner(request(app).get('/api/v1/approval-policy'));
      expect(current.status).toBe(200);
      const same = await owner(request(app).put('/api/v1/approval-policy')).send(data(current));
      expect(same.status).toBe(200);
      expect(data(same)).toEqual(data(current));

      const bad = await owner(request(app).put('/api/v1/approval-policy')).send({
        ...data<object>(current),
        approverRole: 'analyst',
      });
      expect(bad.status).toBe(400);
    });
  });

  describe('automations', () => {
    const rule = {
      name: 'B4 CPL watch',
      trigger: { platforms: ['google_ads'], schedule: null },
      condition: {
        metric: 'cpl',
        operator: 'above',
        value: 28,
        window: { amount: 3, unit: 'days' },
      },
      action: 'notify',
      enabled: true,
    };

    it('creates, lists, toggles and deletes a rule', async () => {
      const created = await owner(request(app).post('/api/v1/automations')).send(rule);
      expect(created.status).toBe(201);
      const id = data<Item>(created).id;
      ruleIds.push(id);

      const digest = await owner(request(app).post('/api/v1/automations')).send({
        name: 'B4 weekly digest',
        trigger: { platforms: [], schedule: '0 8 * * 1' },
        condition: null,
        action: 'send_digest',
        enabled: true,
      });
      expect(digest.status).toBe(201);
      expect(data<Item>(digest).condition).toBeNull();
      ruleIds.push(data<Item>(digest).id);

      const list = await owner(request(app).get('/api/v1/automations?q=B4'));
      expect(data<Item[]>(list).map((r) => r.id)).toEqual(expect.arrayContaining(ruleIds));

      const off = await owner(request(app).patch(`/api/v1/automations/${id}`)).send({
        enabled: false,
      });
      expect(data<Item>(off).enabled).toBe(false);

      const activity = await owner(request(app).get('/api/v1/automations/activity'));
      expect(activity.status).toBe(200);

      const removed = await owner(request(app).delete(`/api/v1/automations/${id}`));
      expect(removed.status).toBe(204);
    });

    it('rejects a bad rule, forbids a member, and answers 404 across workspaces', async () => {
      const bad = await owner(request(app).post('/api/v1/automations')).send({
        ...rule,
        action: 'x',
      });
      expect(bad.status).toBe(400);
      expect((await member(request(app).post('/api/v1/automations')).send(rule)).status).toBe(403);
      const other = await owner(request(app).patch(`/api/v1/automations/${otherIds.rule}`)).send({
        enabled: false,
      });
      expect(other.status).toBe(404);
    });
  });

  describe('reports', () => {
    const report = {
      name: 'B4 report',
      view: { platforms: ['google_ads'], rangeDays: 30, compare: 'previous_period' },
      schedule: null,
      recipients: ['finance@lulu.test'],
    };

    it('saves a report and runs it', async () => {
      const created = await owner(request(app).post('/api/v1/reports')).send(report);
      expect(created.status).toBe(201);
      const id = data<Item>(created).id;
      reportIds.push(id);

      const run = await owner(request(app).get(`/api/v1/reports/${id}/run`));
      expect(run.status).toBe(200);
      expect(data<{ channels: unknown[] }>(run).channels).toHaveLength(1);

      const patched = await owner(request(app).patch(`/api/v1/reports/${id}`)).send({
        name: 'B4 report renamed',
      });
      expect(data<Item>(patched).name).toBe('B4 report renamed');
    });

    it('runs an ad hoc report and validates the query', async () => {
      const run = await owner(
        request(app).get('/api/v1/reports/run?from=2026-06-01&to=2026-06-30&platforms=google_ads'),
      );
      expect(run.status).toBe(200);
      expect(data<{ currency: string; channels: unknown[] }>(run)).toMatchObject({
        currency: 'EUR',
        channels: [expect.anything()],
      });
      const all = await owner(
        request(app).get('/api/v1/reports/run?from=2026-06-01&to=2026-06-30'),
      );
      expect(data<{ channels: unknown[] }>(all).channels).toHaveLength(4);

      expect(
        (await owner(request(app).get('/api/v1/reports/run?from=2026-06-30&to=2026-06-01'))).status,
      ).toBe(400);
      expect(
        (
          await owner(
            request(app).get('/api/v1/reports/run?from=2026-06-01&to=2026-06-30&platforms=tiktok'),
          )
        ).status,
      ).toBe(400);
    });

    it('answers 404 across workspaces and forbids a member delete', async () => {
      expect((await owner(request(app).get(`/api/v1/reports/${otherIds.report}`))).status).toBe(
        404,
      );
      expect((await owner(request(app).get(`/api/v1/reports/${otherIds.report}/run`))).status).toBe(
        404,
      );

      const created = await member(request(app).post('/api/v1/reports')).send(report);
      expect(created.status).toBe(201);
      const id = data<Item>(created).id;
      reportIds.push(id);
      expect((await member(request(app).delete(`/api/v1/reports/${id}`))).status).toBe(403);
    });
  });

  describe('operations', () => {
    it('returns the summary and the sync history', async () => {
      const res = await owner(request(app).get('/api/v1/operations'));
      expect(res.status).toBe(200);
      const body = data<{ successRate: number; incidents: unknown[]; reconciled: number }>(res);
      expect(body.successRate).toBeGreaterThanOrEqual(0);
      expect(body.successRate).toBeLessThanOrEqual(1);
      expect(Array.isArray(body.incidents)).toBe(true);

      const runs = await owner(request(app).get('/api/v1/operations/sync-runs?pageSize=5'));
      expect(runs.status).toBe(200);
      expect((runs.body as { meta: { page: number } }).meta.page).toBe(1);
    });

    it('retries a failed sync and refuses incidents that need a person', async () => {
      const failed = randomUUID();
      const consent = randomUUID();
      incidentIds.push(failed, consent);
      await db.incident.createMany({
        data: [
          {
            id: failed,
            workspaceId: SEED_WORKSPACE_ID,
            platform: 'google_ads',
            kind: 'sync_failed',
            subject: 'B4 failed',
          },
          {
            id: consent,
            workspaceId: SEED_WORKSPACE_ID,
            platform: 'google_ads',
            kind: 'consent_review',
            subject: 'B4 consent',
          },
        ],
      });

      const retried = await owner(
        request(app).post(`/api/v1/operations/incidents/${failed}/retry`),
      );
      expect(retried.status).toBe(200);
      expect(queueMocks.enqueueAdsSync).toHaveBeenCalledWith({
        workspaceId: SEED_WORKSPACE_ID,
        adAccountId: SEED_AD_ACCOUNT_IDS.googleAds,
      });
      expect(
        (await owner(request(app).post(`/api/v1/operations/incidents/${consent}/retry`))).status,
      ).toBe(409);
    });

    it('answers 404 across workspaces and forbids a member', async () => {
      expect(
        (await owner(request(app).post(`/api/v1/operations/incidents/${otherIds.incident}/retry`)))
          .status,
      ).toBe(404);
      expect((await member(request(app).post('/api/v1/operations/reconcile'))).status).toBe(403);
      expect((await owner(request(app).post('/api/v1/operations/reconcile'))).status).toBe(200);
    });
  });

  describe('team', () => {
    it('lists the team with an owner', async () => {
      const res = await owner(request(app).get('/api/v1/team'));
      expect(res.status).toBe(200);
      expect(data<Item[]>(res).some((m) => m.adsRole === 'owner')).toBe(true);
    });

    it('invites, rejects a duplicate and edits a teammate', async () => {
      const invite = {
        email: `invitee-${randomUUID()}@lulu.test`,
        adsRole: 'analyst',
        channelScope: 'reports_only',
        canApproveCreatives: false,
      };
      const created = await owner(request(app).post('/api/v1/team/invitations')).send(invite);
      expect(created.status).toBe(201);
      const invitee = data<Item>(created);
      teamUserIds.push(invitee.userId as string);
      expect(invitee.invited).toBe(true);

      expect((await owner(request(app).post('/api/v1/team/invitations')).send(invite)).status).toBe(
        409,
      );
      expect(
        (
          await owner(request(app).post('/api/v1/team/invitations')).send({
            ...invite,
            adsRole: 'owner',
          })
        ).status,
      ).toBe(400);

      const patched = await owner(request(app).patch(`/api/v1/team/${invitee.userId}`)).send({
        adsRole: 'editor',
        canApproveCreatives: true,
      });
      expect(patched.status).toBe(200);
      expect(data<Item>(patched)).toMatchObject({ adsRole: 'editor', canApproveCreatives: true });
    });

    it('protects the owner and other workspaces, and forbids a member', async () => {
      const team = data<Item[]>(await owner(request(app).get('/api/v1/team')));
      const ownerMember = team.find((m) => m.adsRole === 'owner');
      expect(ownerMember).toBeDefined();
      expect(
        (
          await owner(request(app).patch(`/api/v1/team/${ownerMember?.userId}`)).send({
            adsRole: 'editor',
          })
        ).status,
      ).toBe(403);
      expect(
        (await owner(request(app).patch(`/api/v1/team/${otherUserId}`)).send({ adsRole: 'editor' }))
          .status,
      ).toBe(404);
      expect(
        (
          await member(request(app).post('/api/v1/team/invitations')).send({
            email: 'nobody@lulu.test',
            adsRole: 'analyst',
            channelScope: 'all',
            canApproveCreatives: false,
          })
        ).status,
      ).toBe(403);
    });
  });

  describe('billing', () => {
    it('returns the payment method and only this workspace statements', async () => {
      const method = await owner(request(app).get('/api/v1/billing/payment-method'));
      expect(method.status).toBe(200);
      expect(data<{ status: string }>(method).status).toEqual(expect.any(String));

      const statements = await owner(request(app).get('/api/v1/billing/statements'));
      expect(statements.status).toBe(200);
      expect(data<Item[]>(statements).map((s) => s.id)).not.toContain(otherIds.statement);
    });

    it('forbids a member', async () => {
      expect((await member(request(app).get('/api/v1/billing/payment-method'))).status).toBe(403);
      expect((await member(request(app).get('/api/v1/billing/statements'))).status).toBe(403);
    });
  });
});
