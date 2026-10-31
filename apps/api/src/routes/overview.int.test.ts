import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../prisma/seed';
import { createApp } from '../app';
import { env } from '../config/env';
import { db } from '../db/prisma';
import { disconnectRedis } from '../lib/redis';
import { hashPassword } from '../services/auth';

const SEEDED_OWNER = { email: 'jamie.morgan@lulu.test', password: env.SEED_OWNER_PASSWORD };
const CONTROLLED_PASSWORD = 'controlled-workspace-password';

interface OverviewBody {
  data: {
    rangeDays: number;
    endDate: string;
    currency: string;
    spend: { value: number; change: number | null; trend: number[] };
    revenue: { value: number; change: number | null; trend: number[] };
    leads: { value: number; change: number | null; trend: number[] };
    cpl: { value: number; change: number | null; trend: number[] };
    roas: { value: number; change: number | null; trend: number[] };
    platforms: Array<{
      platform: string;
      connected: boolean;
      campaigns: number;
      spend: { amount: number; currency: string };
      leads: number;
    }>;
  };
}

async function login(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return (res.body as { data: { token: string } }).data.token;
}

describe('overview route (int)', () => {
  const app = createApp();
  let seededToken: string;
  let controlledToken: string;

  const workspaceId = randomUUID();
  const userId = randomUUID();
  const campaignId = randomUUID();
  const email = `controlled-${workspaceId}@lulu.test`;

  async function addDay(
    date: string,
    spend: number,
    revenue: number,
    leads: number,
  ): Promise<void> {
    await db.campaignMetricDay.create({
      data: {
        workspaceId,
        campaignId,
        date: new Date(`${date}T00:00:00.000Z`),
        impressions: 1000,
        clicks: 50,
        conversions: leads,
        leads,
        calls: 0,
        spendAmount: spend,
        revenueAmount: revenue,
        currency: 'EUR',
      },
    });
  }

  beforeAll(async () => {
    await runSeed();
    seededToken = await login(app, SEEDED_OWNER.email, SEEDED_OWNER.password);

    await db.workspace.create({
      data: { id: workspaceId, name: 'Controlled workspace', defaultCurrency: 'EUR' },
    });
    await db.user.create({
      data: {
        id: userId,
        workspaceId,
        name: 'Controlled Owner',
        email,
        passwordHash: await hashPassword(CONTROLLED_PASSWORD),
        role: 'owner',
      },
    });
    await db.campaign.create({
      data: {
        id: campaignId,
        workspaceId,
        platform: 'google_ads',
        name: 'Controlled campaign',
        status: 'live',
        objective: 'Leads',
        budgetAmount: 1000,
        budgetCurrency: 'EUR',
        ownerId: userId,
      },
    });

    // Current range: 1–2 Jan. Previous range: 30–31 Dec. The November day is older than both.
    await addDay('2025-11-01', 100, 100, 10);
    await addDay('2025-12-30', 5, 5, 1);
    await addDay('2025-12-31', 5, 5, 1);
    await addDay('2026-01-01', 10, 20, 1);
    await addDay('2026-01-02', 20, 40, 2);

    controlledToken = await login(app, email, CONTROLLED_PASSWORD);
  }, 180_000);

  afterAll(async () => {
    await db.campaignMetricDay.deleteMany({ where: { workspaceId } });
    await db.campaign.deleteMany({ where: { workspaceId } });
    await db.user.deleteMany({ where: { workspaceId } });
    await db.workspace.deleteMany({ where: { id: workspaceId } });

    await db.$disconnect();
    await disconnectRedis();
  });

  it('matches the seeded totals and platform split over 366 days', async () => {
    const res = await request(app)
      .get('/api/v1/overview?rangeDays=366')
      .set('Authorization', `Bearer ${seededToken}`);
    expect(res.status).toBe(200);
    const overview = (res.body as OverviewBody).data;

    expect(overview).toMatchObject({
      rangeDays: 366,
      endDate: '2026-07-07',
      currency: 'EUR',
      spend: { value: 8880 },
      revenue: { value: 50920 },
      leads: { value: 511 },
    });

    const byPlatform = new Map(overview.platforms.map((p) => [p.platform, p]));
    expect(byPlatform.get('google_ads')).toMatchObject({
      connected: true,
      campaigns: 1,
      spend: { amount: 4280, currency: 'EUR' },
      leads: 184,
    });
    expect(byPlatform.get('google_lsa')).toMatchObject({
      connected: true,
      spend: { amount: 1940 },
      leads: 96,
    });
    expect(byPlatform.get('meta_ads')).toMatchObject({
      connected: true,
      spend: { amount: 2660 },
      leads: 231,
    });
    expect(byPlatform.get('linkedin_ads')).toMatchObject({
      connected: false,
      campaigns: 1,
      spend: { amount: 0 },
      leads: 0,
    });
  });

  it('compares the preceding range of the same length and ignores older days', async () => {
    const res = await request(app)
      .get('/api/v1/overview?rangeDays=2')
      .set('Authorization', `Bearer ${controlledToken}`);
    expect(res.status).toBe(200);
    const overview = (res.body as OverviewBody).data;

    expect(overview).toMatchObject({
      rangeDays: 2,
      endDate: '2026-01-02',
      currency: 'EUR',
      spend: { value: 30, change: 2, trend: [10, 20] },
      revenue: { value: 60, change: 5, trend: [20, 40] },
      leads: { value: 3, change: 0.5, trend: [1, 2] },
      cpl: { value: 10, change: 1, trend: [10, 10] },
      roas: { value: 2, change: 1, trend: [2, 2] },
    });

    expect(overview.platforms.find((p) => p.platform === 'google_ads')).toMatchObject({
      campaigns: 1,
      spend: { amount: 30 },
      leads: 3,
    });
  });

  it('sees only its own workspace data', async () => {
    const res = await request(app)
      .get('/api/v1/overview?rangeDays=2')
      .set('Authorization', `Bearer ${controlledToken}`);
    expect(res.status).toBe(200);
    const overview = (res.body as OverviewBody).data;
    expect(overview.spend.value).toBe(30);
    expect(overview.leads.value).toBe(3);
    expect(overview.platforms.find((p) => p.platform === 'google_ads')?.campaigns).toBe(1);
  });

  it('rejects a range outside 1 to 366 days', async () => {
    const zero = await request(app)
      .get('/api/v1/overview?rangeDays=0')
      .set('Authorization', `Bearer ${seededToken}`);
    expect(zero.status).toBe(400);

    const tooLong = await request(app)
      .get('/api/v1/overview?rangeDays=367')
      .set('Authorization', `Bearer ${seededToken}`);
    expect(tooLong.status).toBe(400);
  });
});
