import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providers')>();
  return { ...actual, campaignCreationSupported: () => false };
});

vi.mock('../jobs/queues', () => ({
  enqueueAdsPush: vi.fn(),
}));

import { runSeed } from '../../prisma/seed';
import { SEED_AD_ACCOUNT_IDS, SEED_JAMIE_ID, SEED_WORKSPACE_ID } from '../../prisma/seed-ids';
import { db } from '../db/prisma';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { launchCampaign } from './campaigns';

describe('launch guard for live Google LSA (int)', () => {
  const campaignIds: string[] = [];

  beforeAll(async () => {
    await runSeed();
  }, 180_000);

  afterAll(async () => {
    await db.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await db.$disconnect();
  });

  it('rejects a live Google LSA draft without an external campaign and keeps it draft', async () => {
    const id = randomUUID();
    campaignIds.push(id);
    await db.campaign.create({
      data: {
        id,
        workspaceId: SEED_WORKSPACE_ID,
        adAccountId: SEED_AD_ACCOUNT_IDS.googleLsa,
        platform: 'google_lsa',
        externalId: null,
        name: 'Unsupported LSA draft',
        status: 'draft',
        objective: 'Local calls',
        budgetAmount: 1000,
        budgetCurrency: 'EUR',
        ownerId: SEED_JAMIE_ID,
      },
    });

    const ctx: RequestContext = {
      workspaceId: SEED_WORKSPACE_ID,
      userId: SEED_JAMIE_ID,
      role: 'owner',
    };

    const error = await launchCampaign(ctx, id).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'CONFLICT',
      status: 409,
      details: { reason: 'campaign_creation_unsupported', platform: 'google_lsa' },
    });
    const campaign = await db.campaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.status).toBe('draft');
    expect(campaign.externalId).toBeNull();
  });
});
