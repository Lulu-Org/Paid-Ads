import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '../db/prisma';
import { encryptToken } from '../lib/tokenCrypto';
import { simulatedProviders } from '../providers/simulated';
import { processAdsPush } from './adsPush';
import { processAdsSync } from './adsSync';

describe('ads processors (int)', () => {
  const workspaceId = randomUUID();
  const ownerId = randomUUID();
  const googleAdsId = randomUUID();
  const lsaId = randomUUID();
  const metaId = randomUUID();
  const metaCampaignId = randomUUID();

  beforeAll(async () => {
    await db.workspace.create({ data: { id: workspaceId, name: 'Ads processors test' } });
    await db.user.create({
      data: {
        id: ownerId,
        workspaceId,
        name: 'Processor Owner',
        email: `processors-${workspaceId}@lulu.test`,
        passwordHash: 'not-used',
        role: 'owner',
      },
    });
    await db.adAccount.createMany({
      data: [
        {
          id: googleAdsId,
          workspaceId,
          platform: 'google_ads',
          externalId: 'account_google_ads_ext',
          name: 'Google Ads test',
          currency: 'EUR',
          status: 'connected',
          scopes: ['read', 'manage'],
          tokenEncrypted: encryptToken('simulated-token:google_ads'),
        },
        {
          id: lsaId,
          workspaceId,
          platform: 'google_lsa',
          externalId: 'account_google_lsa_ext',
          name: 'LSA test',
          currency: 'EUR',
          status: 'connected',
          scopes: ['read', 'manage'],
          tokenEncrypted: encryptToken('simulated-token:google_lsa'),
        },
        {
          id: metaId,
          workspaceId,
          platform: 'meta_ads',
          externalId: 'account_meta_ext',
          name: 'Meta test',
          currency: 'EUR',
          status: 'connected',
          scopes: ['read', 'manage'],
          tokenEncrypted: encryptToken('simulated-token:meta_ads'),
        },
      ],
    });
    await db.campaign.create({
      data: {
        id: metaCampaignId,
        workspaceId,
        adAccountId: metaId,
        platform: 'meta_ads',
        externalId: null,
        name: 'Push me',
        status: 'live',
        objective: 'Leads',
        budgetAmount: 50,
        budgetCurrency: 'EUR',
        ownerId,
      },
    });
  }, 180_000);

  afterAll(async () => {
    await db.campaignMetricDay.deleteMany({ where: { workspaceId } });
    await db.campaign.deleteMany({ where: { workspaceId } });
    await db.syncRun.deleteMany({ where: { workspaceId } });
    await db.adAccount.deleteMany({ where: { workspaceId } });
    await db.user.deleteMany({ where: { workspaceId } });
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
  });

  it('syncs campaigns and metric days idempotently', async () => {
    const first = await processAdsSync({ workspaceId, adAccountId: googleAdsId });
    expect(first.campaigns).toBe(1);
    expect(first.metricDays).toBe(30);

    const second = await processAdsSync({ workspaceId, adAccountId: googleAdsId });
    expect(second.campaigns).toBe(1);
    expect(second.metricDays).toBe(30);

    const campaigns = await db.campaign.findMany({
      where: { workspaceId, platform: 'google_ads' },
    });
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]).toMatchObject({ externalId: 'g_1001', ownerId, adAccountId: googleAdsId });

    const days = await db.campaignMetricDay.findMany({ where: { workspaceId } });
    expect(days).toHaveLength(30);
    expect(days.every((day) => day.calls === 0)).toBe(true);

    const account = await db.adAccount.findFirst({ where: { id: googleAdsId } });
    expect(account).toMatchObject({ status: 'connected', lastError: null });
    expect(account!.lastSyncAt).not.toBeNull();
  }, 60_000);

  it('records a failed sync and marks the account for attention', async () => {
    const spy = vi
      .spyOn(simulatedProviders.google_lsa, 'listCampaigns')
      .mockRejectedValueOnce(new Error('provider down'));

    await expect(processAdsSync({ workspaceId, adAccountId: lsaId })).rejects.toThrow(
      'provider down',
    );
    spy.mockRestore();

    const run = await db.syncRun.findFirst({
      where: { workspaceId, adAccountId: lsaId },
      orderBy: { startedAt: 'desc' },
    });
    expect(run).toMatchObject({ status: 'failed', error: 'provider down' });
    const account = await db.adAccount.findFirst({ where: { id: lsaId } });
    expect(account).toMatchObject({ status: 'needs_attention', lastError: 'provider down' });
  });

  it('persists calls for the LSA campaign', async () => {
    const result = await processAdsSync({ workspaceId, adAccountId: lsaId });
    expect(result.metricDays).toBe(30);

    const days = await db.campaignMetricDay.findMany({
      where: { workspaceId, campaign: { platform: 'google_lsa' } },
    });
    expect(days).toHaveLength(30);
    expect(days.every((day) => day.calls === day.leads)).toBe(true);
  }, 60_000);

  it('pushes a campaign once and keeps the external id on retry', async () => {
    const spy = vi.spyOn(simulatedProviders.meta_ads, 'pushCampaign');
    const payload = { workspaceId, campaignId: metaCampaignId, requestedById: ownerId };

    const first = await processAdsPush(payload);
    const second = await processAdsPush(payload);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    expect(first.externalId).toBe(`sim-meta_ads-${metaCampaignId}`);
    expect(second.externalId).toBe(first.externalId);

    const campaign = await db.campaign.findFirst({ where: { id: metaCampaignId } });
    expect(campaign!.externalId).toBe(first.externalId);

    const runs = await db.syncRun.findMany({
      where: { workspaceId, adAccountId: metaId, kind: 'push' },
    });
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.status === 'succeeded')).toBe(true);
  });
});
