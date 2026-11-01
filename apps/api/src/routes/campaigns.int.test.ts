import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runSeed } from '../../prisma/seed';
import {
  SEED_AD_ACCOUNT_IDS,
  SEED_CAMPAIGN_IDS,
  SEED_CREATIVE_IDS,
  SEED_JAMIE_ID,
  SEED_WORKSPACE_ID,
} from '../../prisma/seed-ids';
import { createApp } from '../app';
import { env } from '../config/env';
import { db } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';
import { disconnectRedis } from '../lib/redis';
import { hashPassword } from '../services/auth';

const queueMocks = vi.hoisted(() => ({
  enqueueAdsPush: vi.fn().mockResolvedValue({ id: 'job' }),
}));

vi.mock('../jobs/queues', () => queueMocks);

const OWNER = { email: 'jamie.morgan@lulu.test', password: env.SEED_OWNER_PASSWORD };

interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

interface CampaignBody {
  data: {
    id: string;
    name: string;
    status: string;
    ownerId: string;
    externalId: string | null;
    budget: { amount: number; currency: string };
    budgetPeriod: string;
    totals?: {
      spend: { amount: number; currency: string };
      leads: number;
      cpl: { amount: number } | null;
    };
  };
}

interface ListBody {
  data: Array<CampaignBody['data']>;
  meta: { page: number; pageSize: number; total: number };
}

interface ApprovalBody {
  data: {
    id: string;
    kind: string;
    campaignId: string;
    status: string;
    payload: Record<string, unknown>;
  };
}

interface ChecklistBody {
  data: {
    items: Array<{ key: string; passed: boolean }>;
    passed: number;
    total: number;
  };
}

async function login(app: Express, credentials = OWNER): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send(credentials);
  expect(res.status).toBe(200);
  return (res.body as { data: { token: string } }).data.token;
}

describe('campaign routes (int)', () => {
  const app = createApp();
  let token: string;
  const createdCampaignIds: string[] = [];
  const otherWorkspaceId = randomUUID();
  const otherUserId = randomUUID();
  const otherCampaignId = randomUUID();

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  async function createCampaignRow(
    overrides: Partial<Prisma.CampaignUncheckedCreateInput> = {},
  ): Promise<string> {
    const id = randomUUID();
    await db.campaign.create({
      data: {
        id,
        workspaceId: SEED_WORKSPACE_ID,
        platform: 'google_ads',
        adAccountId: SEED_AD_ACCOUNT_IDS.googleAds,
        name: `Test campaign ${id}`,
        status: 'draft',
        objective: 'Qualified leads',
        audienceSummary: 'Berlin',
        startAt: new Date('2026-11-01T00:00:00.000Z'),
        budgetAmount: 1000,
        budgetCurrency: 'EUR',
        ownerId: SEED_JAMIE_ID,
        ...overrides,
      },
    });
    createdCampaignIds.push(id);
    return id;
  }

  async function attachApprovedCreative(campaignId: string): Promise<void> {
    await db.campaignCreative.create({
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        campaignId,
        creativeId: SEED_CREATIVE_IDS.springRsa,
        variant: 'A',
      },
    });
  }

  beforeAll(async () => {
    await runSeed();
    token = await login(app);

    await db.workspace.create({
      data: { id: otherWorkspaceId, name: 'Other workspace' },
    });
    await db.user.create({
      data: {
        id: otherUserId,
        workspaceId: otherWorkspaceId,
        name: 'Other Owner',
        email: `other-${otherWorkspaceId}@lulu.test`,
        passwordHash: await hashPassword('other-workspace-password'),
        role: 'owner',
      },
    });
    await db.campaign.create({
      data: {
        id: otherCampaignId,
        workspaceId: otherWorkspaceId,
        platform: 'google_ads',
        name: 'Other workspace campaign',
        status: 'draft',
        objective: 'Leads',
        budgetAmount: 1000,
        budgetCurrency: 'EUR',
        ownerId: otherUserId,
      },
    });
  }, 180_000);

  afterAll(async () => {
    await db.approvalRequest.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
    await db.campaignPlanStep.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
    await db.campaignCreative.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
    await db.campaignMetricDay.deleteMany({ where: { campaignId: { in: createdCampaignIds } } });
    await db.campaign.deleteMany({ where: { id: { in: createdCampaignIds } } });

    await db.approvalRequest.deleteMany({ where: { campaignId: otherCampaignId } });
    await db.campaign.deleteMany({ where: { id: otherCampaignId } });
    await db.user.deleteMany({ where: { workspaceId: otherWorkspaceId } });
    await db.workspace.deleteMany({ where: { id: otherWorkspaceId } });

    await db.$disconnect();
    await disconnectRedis();
  });

  describe('list and detail', () => {
    it('lists the seeded campaigns with their totals', async () => {
      const res = await auth(request(app).get('/api/v1/campaigns'));
      expect(res.status).toBe(200);
      const body = res.body as ListBody;
      expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 4 });

      const spring = body.data.find((c) => c.id === SEED_CAMPAIGN_IDS.springBerlin);
      expect(spring?.totals).toMatchObject({
        spend: { amount: 4280 },
        leads: 184,
        cpl: { amount: 23.26 },
      });
      expect(spring?.totals?.spend.currency).toBe('EUR');
    });

    it('filters by platform and status', async () => {
      const platform = await auth(request(app).get('/api/v1/campaigns?platform=meta_ads'));
      expect((platform.body as ListBody).meta.total).toBe(1);
      expect((platform.body as ListBody).data[0]?.id).toBe(SEED_CAMPAIGN_IDS.studioAwareness);

      const status = await auth(request(app).get('/api/v1/campaigns?status=draft'));
      expect((status.body as ListBody).meta.total).toBe(1);
      expect((status.body as ListBody).data[0]?.id).toBe(SEED_CAMPAIGN_IDS.b2bQ4);
    });

    it('searches name and objective, rejects unsupported sorts and paginates', async () => {
      const search = await auth(request(app).get('/api/v1/campaigns?q=berlin'));
      expect((search.body as ListBody).meta.total).toBe(1);
      expect((search.body as ListBody).data[0]?.id).toBe(SEED_CAMPAIGN_IDS.springBerlin);

      const badSort = await auth(request(app).get('/api/v1/campaigns?sort=email'));
      expect(badSort.status).toBe(400);

      const page = await auth(request(app).get('/api/v1/campaigns?page=2&pageSize=2'));
      expect((page.body as ListBody).meta).toEqual({ page: 2, pageSize: 2, total: 4 });
      expect((page.body as ListBody).data).toHaveLength(2);
    });

    it('returns detail with days, ordered plan and creative ids', async () => {
      const res = await auth(
        request(app).get(`/api/v1/campaigns/${SEED_CAMPAIGN_IDS.springBerlin}`),
      );
      expect(res.status).toBe(200);
      const body = res.body as {
        data: {
          days: Array<{ date: string }>;
          plan: Array<{ order: number; label: string }>;
          creativeIds: string[];
        };
      };
      expect(body.data.days).toHaveLength(30);
      expect(body.data.days[0]?.date).toBe('2026-06-01');
      expect(body.data.plan.map((step) => step.order)).toEqual([0, 1, 2, 3, 4]);
      expect(body.data.plan[0]?.label).toBe('Strategy approved');
      expect(body.data.creativeIds).toHaveLength(3);
    });

    it('answers 404 for another workspace campaign', async () => {
      const res = await auth(request(app).get(`/api/v1/campaigns/${otherCampaignId}`));
      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });
  });

  describe('create and update', () => {
    it('creates a draft and defaults the owner to the current user', async () => {
      const res = await auth(request(app).post('/api/v1/campaigns')).send({
        platform: 'google_ads',
        name: 'Created draft',
        objective: 'Qualified leads',
        budget: { amount: 1000, currency: 'EUR' },
      });
      expect(res.status).toBe(201);
      const body = res.body as CampaignBody;
      createdCampaignIds.push(body.data.id);
      expect(body.data).toMatchObject({
        status: 'draft',
        ownerId: SEED_JAMIE_ID,
        externalId: null,
        budget: { amount: 1000, currency: 'EUR' },
        budgetPeriod: 'monthly',
      });
    });

    it('changes the budget period of a draft, and refuses it once the campaign is on the platform', async () => {
      const draft = await createCampaignRow();
      const changed = await auth(request(app).patch(`/api/v1/campaigns/${draft}`)).send({
        budgetPeriod: 'daily',
      });
      expect(changed.status).toBe(200);
      expect((changed.body as CampaignBody).data.budgetPeriod).toBe('daily');

      const live = await createCampaignRow({ status: 'live', externalId: `ext-${randomUUID()}` });
      const locked = await auth(request(app).patch(`/api/v1/campaigns/${live}`)).send({
        budgetPeriod: 'total',
      });
      expect(locked.status).toBe(409);
      expect((locked.body as ErrorBody).error.details).toEqual({ reason: 'budget_period_locked' });
      const detail = await auth(request(app).get(`/api/v1/campaigns/${live}`));
      expect((detail.body as CampaignBody).data.budgetPeriod).toBe('monthly');
    });

    it('rejects an unknown ad account and an account on another platform', async () => {
      const unknown = await auth(request(app).post('/api/v1/campaigns')).send({
        platform: 'google_ads',
        adAccountId: randomUUID(),
        name: 'Unknown account',
        objective: 'Leads',
        budget: { amount: 1000, currency: 'EUR' },
      });
      expect(unknown.status).toBe(400);
      expect((unknown.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

      const wrongPlatform = await auth(request(app).post('/api/v1/campaigns')).send({
        platform: 'google_ads',
        adAccountId: SEED_AD_ACCOUNT_IDS.meta,
        name: 'Wrong account',
        objective: 'Leads',
        budget: { amount: 1000, currency: 'EUR' },
      });
      expect(wrongPlatform.status).toBe(400);
    });

    it('updates details, and budget changes at or below the threshold immediately', async () => {
      const created = await auth(request(app).post('/api/v1/campaigns')).send({
        platform: 'google_ads',
        name: 'Budget campaign',
        objective: 'Leads',
        budget: { amount: 1000, currency: 'EUR' },
      });
      const id = (created.body as CampaignBody).data.id;
      createdCampaignIds.push(id);

      const details = await auth(request(app).patch(`/api/v1/campaigns/${id}`)).send({
        name: 'Renamed campaign',
        objective: 'Pipeline',
        startAt: '2026-12-01T00:00:00.000Z',
      });
      expect(details.status).toBe(200);
      expect(details.body as CampaignBody).toMatchObject({
        data: {
          name: 'Renamed campaign',
          objective: 'Pipeline',
          startAt: '2026-12-01T00:00:00.000Z',
        },
      });

      const below = await auth(request(app).patch(`/api/v1/campaigns/${id}`)).send({
        budget: { amount: 1050, currency: 'EUR' },
      });
      expect(below.status).toBe(200);
      expect((below.body as CampaignBody).data.budget.amount).toBe(1050);

      // Current 1050, threshold 2500: a resulting total of 3550 is exactly at the threshold.
      const atThreshold = await auth(request(app).patch(`/api/v1/campaigns/${id}`)).send({
        budget: { amount: 3550, currency: 'EUR' },
      });
      expect(atThreshold.status).toBe(200);
      expect((atThreshold.body as CampaignBody).data.budget.amount).toBe(3550);
    });

    it('holds the whole PATCH and returns the open approval above the threshold', async () => {
      const created = await auth(request(app).post('/api/v1/campaigns')).send({
        platform: 'google_ads',
        name: 'Approval campaign',
        objective: 'Leads',
        budget: { amount: 1000, currency: 'EUR' },
      });
      const id = (created.body as CampaignBody).data.id;
      createdCampaignIds.push(id);

      const patch = { name: 'Should not apply', budget: { amount: 4000, currency: 'EUR' } };
      const res = await auth(request(app).patch(`/api/v1/campaigns/${id}`)).send(patch);
      expect(res.status).toBe(202);
      const approval = (res.body as ApprovalBody).data;
      expect(approval).toMatchObject({
        kind: 'budget_change',
        campaignId: id,
        status: 'pending',
        payload: { budget: { amount: 4000, currency: 'EUR' } },
      });

      const detail = await auth(request(app).get(`/api/v1/campaigns/${id}`));
      const campaign = detail.body as CampaignBody;
      expect(campaign.data.name).toBe('Approval campaign');
      expect(campaign.data.budget.amount).toBe(1000);

      const again = await auth(request(app).patch(`/api/v1/campaigns/${id}`)).send(patch);
      expect(again.status).toBe(202);
      expect((again.body as ApprovalBody).data.id).toBe(approval.id);

      const other = await auth(
        request(app).patch(`/api/v1/campaigns/${otherCampaignId}`).send({ name: 'Nope' }),
      );
      expect(other.status).toBe(404);
    });
  });

  describe('plan', () => {
    it('returns the seeded plan ordered', async () => {
      const res = await auth(
        request(app).get(`/api/v1/campaigns/${SEED_CAMPAIGN_IDS.springBerlin}/plan`),
      );
      expect(res.status).toBe(200);
      const steps = (res.body as { data: { steps: Array<{ order: number }> } }).data.steps;
      expect(steps.map((step) => step.order)).toEqual([0, 1, 2, 3, 4]);
    });

    it('replaces the plan atomically and rejects more than 20 steps', async () => {
      const id = await createCampaignRow();
      await db.campaignPlanStep.create({
        data: {
          workspaceId: SEED_WORKSPACE_ID,
          campaignId: id,
          order: 0,
          label: 'Old step',
          detail: 'Old',
          status: 'done',
        },
      });

      const replaced = await auth(request(app).put(`/api/v1/campaigns/${id}/plan`)).send({
        steps: [
          { label: 'New first', detail: 'First', status: 'current' },
          { label: 'New second', detail: 'Second', status: 'upcoming' },
        ],
      });
      expect(replaced.status).toBe(200);
      const steps = (
        replaced.body as { data: { steps: Array<{ id: string; order: number; label: string }> } }
      ).data.steps;
      expect(steps.map((step) => [step.order, step.label])).toEqual([
        [0, 'New first'],
        [1, 'New second'],
      ]);
      expect(steps[0]?.id).toBeTruthy();

      const detail = await auth(request(app).get(`/api/v1/campaigns/${id}`));
      const plan = (detail.body as { data: { plan: Array<{ label: string }> } }).data.plan;
      expect(plan.map((step) => step.label)).toEqual(['New first', 'New second']);

      const tooMany = await auth(request(app).put(`/api/v1/campaigns/${id}/plan`)).send({
        steps: Array.from({ length: 21 }, (_, i) => ({
          label: `Step ${i}`,
          detail: '',
          status: 'upcoming',
        })),
      });
      expect(tooMany.status).toBe(400);
    });

    it('answers 404 for another workspace plan', async () => {
      const res = await auth(request(app).put(`/api/v1/campaigns/${otherCampaignId}/plan`)).send({
        steps: [{ label: 'Step', detail: '', status: 'upcoming' }],
      });
      expect(res.status).toBe(404);
    });
  });

  describe('checklist', () => {
    it('returns the seeded campaign checklist with only the launch approval missing', async () => {
      const res = await auth(
        request(app).get(`/api/v1/campaigns/${SEED_CAMPAIGN_IDS.springBerlin}/checklist`),
      );
      expect(res.status).toBe(200);
      const checklist = (res.body as ChecklistBody).data;
      expect(checklist).toMatchObject({ passed: 9, total: 10 });
      expect(checklist.items.find((item) => item.key === 'approval_granted')?.passed).toBe(false);
    });

    it('reports missing account and creative approval', async () => {
      const id = await createCampaignRow({
        platform: 'linkedin_ads',
        adAccountId: null,
        budgetAmount: 1000,
      });
      const res = await auth(request(app).get(`/api/v1/campaigns/${id}/checklist`));
      expect(res.status).toBe(200);
      const checklist = (res.body as ChecklistBody).data;
      const failed = checklist.items.filter((item) => !item.passed).map((item) => item.key);
      expect(failed).toContain('account_connected');
      expect(failed).toContain('creative_approved');
    });

    it('answers 404 for another workspace checklist', async () => {
      const res = await auth(request(app).get(`/api/v1/campaigns/${otherCampaignId}/checklist`));
      expect(res.status).toBe(404);
    });
  });

  describe('launch', () => {
    it('blocks a draft with missing prerequisites without changing status or queueing', async () => {
      queueMocks.enqueueAdsPush.mockClear();
      const id = await createCampaignRow({
        platform: 'linkedin_ads',
        adAccountId: null,
        budgetAmount: 1000,
      });

      const res = await auth(request(app).post(`/api/v1/campaigns/${id}/launch`));
      expect(res.status).toBe(409);
      const details = (res.body as ErrorBody).error.details as {
        checklist: { items: Array<{ key: string; passed: boolean }> };
      };
      expect(details.checklist.items.some((item) => !item.passed)).toBe(true);

      const detail = await auth(request(app).get(`/api/v1/campaigns/${id}`));
      expect((detail.body as CampaignBody).data.status).toBe('draft');
      expect(queueMocks.enqueueAdsPush).not.toHaveBeenCalled();
    });

    it('asks for launch approval above the policy threshold and stays in draft', async () => {
      queueMocks.enqueueAdsPush.mockClear();
      const id = await createCampaignRow({ budgetAmount: 5000 });
      await attachApprovedCreative(id);

      const res = await auth(request(app).post(`/api/v1/campaigns/${id}/launch`));
      expect(res.status).toBe(202);
      expect((res.body as ApprovalBody).data).toMatchObject({
        kind: 'launch',
        campaignId: id,
        status: 'pending',
      });

      const detail = await auth(request(app).get(`/api/v1/campaigns/${id}`));
      expect((detail.body as CampaignBody).data.status).toBe('draft');
      expect(queueMocks.enqueueAdsPush).not.toHaveBeenCalled();
    });

    it('launches a ready draft below the threshold and queues one push', async () => {
      queueMocks.enqueueAdsPush.mockClear();
      const id = await createCampaignRow({ budgetAmount: 1000 });
      await attachApprovedCreative(id);

      const res = await auth(request(app).post(`/api/v1/campaigns/${id}/launch`));
      expect(res.status).toBe(200);
      expect((res.body as CampaignBody).data.status).toBe('live');
      expect(queueMocks.enqueueAdsPush).toHaveBeenCalledTimes(1);
      expect(queueMocks.enqueueAdsPush).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: SEED_WORKSPACE_ID, campaignId: id }),
      );

      const again = await auth(request(app).post(`/api/v1/campaigns/${id}/launch`));
      expect(again.status).toBe(409);
    });

    it('answers 404 for another workspace launch', async () => {
      const res = await auth(request(app).post(`/api/v1/campaigns/${otherCampaignId}/launch`));
      expect(res.status).toBe(404);
    });
  });

  describe('pause and resume', () => {
    it('pauses only a live campaign and resumes only a paused one', async () => {
      queueMocks.enqueueAdsPush.mockClear();
      const id = await createCampaignRow({ status: 'live' });

      const paused = await auth(request(app).post(`/api/v1/campaigns/${id}/pause`));
      expect(paused.status).toBe(200);
      expect((paused.body as CampaignBody).data.status).toBe('paused');
      expect(queueMocks.enqueueAdsPush).toHaveBeenCalledTimes(1);

      const pauseAgain = await auth(request(app).post(`/api/v1/campaigns/${id}/pause`));
      expect(pauseAgain.status).toBe(409);

      const resumed = await auth(request(app).post(`/api/v1/campaigns/${id}/resume`));
      expect(resumed.status).toBe(200);
      expect((resumed.body as CampaignBody).data.status).toBe('live');
      expect(queueMocks.enqueueAdsPush).toHaveBeenCalledTimes(2);

      const resumeAgain = await auth(request(app).post(`/api/v1/campaigns/${id}/resume`));
      expect(resumeAgain.status).toBe(409);
    });

    it('answers 404 for another workspace status change', async () => {
      const pause = await auth(request(app).post(`/api/v1/campaigns/${otherCampaignId}/pause`));
      expect(pause.status).toBe(404);

      const resume = await auth(request(app).post(`/api/v1/campaigns/${otherCampaignId}/resume`));
      expect(resume.status).toBe(404);
    });
  });
});
