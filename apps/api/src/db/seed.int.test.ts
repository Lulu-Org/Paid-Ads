import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { campaignTotals, type CampaignMetricDay } from '@lulu/shared';
import { runSeed } from '../../prisma/seed';
import { SEED_AD_ACCOUNT_IDS, SEED_CAMPAIGN_IDS, SEED_WORKSPACE_ID } from '../../prisma/seed-ids';
import { db } from './prisma';

const WORKSPACE = { workspaceId: SEED_WORKSPACE_ID };

async function tableCounts() {
  const where = WORKSPACE;
  return {
    users: await db.user.count({ where }),
    adAccounts: await db.adAccount.count({ where }),
    campaigns: await db.campaign.count({ where }),
    campaignMetricDays: await db.campaignMetricDay.count({ where }),
    campaignPlanSteps: await db.campaignPlanStep.count({ where }),
    creatives: await db.creative.count({ where }),
    campaignCreatives: await db.campaignCreative.count({ where }),
    audiences: await db.audience.count({ where }),
    conversionEvents: await db.conversionEvent.count({ where }),
    automationRules: await db.automationRule.count({ where }),
    automationActivities: await db.automationActivity.count({ where }),
    spendLimits: await db.spendLimit.count({ where }),
    approvalPolicies: await db.approvalPolicy.count({ where }),
    teamMembers: await db.teamMember.count({ where }),
    paymentMethods: await db.paymentMethod.count({ where }),
    statements: await db.statement.count({ where }),
    incidents: await db.incident.count({ where }),
    webhookEvents: await db.webhookEvent.count({ where }),
    syncRuns: await db.syncRun.count({ where }),
    approvalRequests: await db.approvalRequest.count({ where }),
    reports: await db.report.count({ where }),
    campaignDefaultsSettings: await db.setting.count({
      where: { ...where, key: 'campaignDefaults' },
    }),
  };
}

async function metricDaysFor(campaignId: string): Promise<CampaignMetricDay[]> {
  const rows = await db.campaignMetricDay.findMany({
    where: { workspaceId: SEED_WORKSPACE_ID, campaignId },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    leads: row.leads,
    calls: row.calls,
    spend: { amount: row.spendAmount.toNumber(), currency: row.currency },
    revenue: { amount: row.revenueAmount.toNumber(), currency: row.currency },
  }));
}

async function totalsFor(campaignId: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  return campaignTotals(
    await metricDaysFor(campaignId),
    { amount: campaign.budgetAmount.toNumber(), currency: campaign.budgetCurrency },
    campaign.budgetPeriod,
  );
}

describe('seed (int)', () => {
  beforeAll(async () => {
    await runSeed();
  }, 180_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it('seeds the design sample data with the expected counts', async () => {
    expect(await tableCounts()).toEqual({
      users: 3,
      adAccounts: 4,
      campaigns: 4,
      campaignMetricDays: 90,
      campaignPlanSteps: 17,
      creatives: 10,
      campaignCreatives: 10,
      audiences: 3,
      conversionEvents: 3,
      automationRules: 3,
      automationActivities: 2,
      spendLimits: 1,
      approvalPolicies: 1,
      teamMembers: 3,
      paymentMethods: 1,
      statements: 2,
      incidents: 2,
      webhookEvents: 3,
      syncRuns: 3,
      approvalRequests: 0,
      reports: 0,
      campaignDefaultsSettings: 1,
    });
  });

  it('runs twice without adding duplicates', async () => {
    const before = await tableCounts();
    await runSeed();
    expect(await tableCounts()).toEqual(before);
  }, 180_000);

  it('matches the design totals for every campaign', async () => {
    const spring = await totalsFor(SEED_CAMPAIGN_IDS.springBerlin);
    expect(spring).toMatchObject({
      spend: { amount: 4280, currency: 'EUR' },
      revenue: { amount: 20480, currency: 'EUR' },
      leads: 184,
      impressions: 412800,
      clicks: 18400,
      cpl: { amount: 23.26, currency: 'EUR' },
    });
    expect(spring.progress).toBeCloseTo(0.71, 2);

    const local = await totalsFor(SEED_CAMPAIGN_IDS.localCalls);
    expect(local).toMatchObject({
      spend: { amount: 1940, currency: 'EUR' },
      revenue: { amount: 11520, currency: 'EUR' },
      leads: 96,
      calls: 96,
      cpl: { amount: 20.21, currency: 'EUR' },
    });
    expect(local.progress).toBeCloseTo(0.65, 2);

    const studio = await totalsFor(SEED_CAMPAIGN_IDS.studioAwareness);
    expect(studio).toMatchObject({
      spend: { amount: 2660, currency: 'EUR' },
      revenue: { amount: 18920, currency: 'EUR' },
      leads: 231,
      cpl: { amount: 11.52, currency: 'EUR' },
    });

    const b2b = await totalsFor(SEED_CAMPAIGN_IDS.b2bQ4);
    expect(b2b).toEqual({
      spend: { amount: 0, currency: 'EUR' },
      revenue: { amount: 0, currency: 'EUR' },
      impressions: 0,
      clicks: 0,
      conversions: 0,
      leads: 0,
      calls: 0,
      ctr: null,
      cpl: null,
      roas: null,
      progress: 0,
    });
  });

  it('seeds the LinkedIn account as disconnected', async () => {
    const linkedin = await db.adAccount.findUniqueOrThrow({
      where: { id: SEED_AD_ACCOUNT_IDS.linkedin },
    });
    expect(linkedin.status).toBe('disconnected');
    expect(linkedin.lastSyncAt).toBeNull();
    expect(linkedin.scopes).toEqual([]);
  });

  it('seeds the team roles and scopes from the design', async () => {
    const members = await db.teamMember.findMany({
      where: WORKSPACE,
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });
    expect(
      members.map((member) => ({
        email: member.user.email,
        adsRole: member.adsRole,
        channelScope: member.channelScope,
        canApproveCreatives: member.canApproveCreatives,
      })),
    ).toEqual([
      {
        email: 'alex.rivera@lulu.test',
        adsRole: 'editor',
        channelScope: 'all',
        canApproveCreatives: true,
      },
      {
        email: 'jamie.morgan@lulu.test',
        adsRole: 'owner',
        channelScope: 'all',
        canApproveCreatives: true,
      },
      {
        email: 'samira.khan@lulu.test',
        adsRole: 'reviewer',
        channelScope: 'reports_only',
        canApproveCreatives: false,
      },
    ]);
  });

  it('seeds the campaign defaults setting', async () => {
    const setting = await db.setting.findUniqueOrThrow({
      where: { workspaceId_key: { workspaceId: SEED_WORKSPACE_ID, key: 'campaignDefaults' } },
    });
    expect(setting.value).toEqual({
      consentRequired: true,
      autoTagLinks: true,
      policyValidation: true,
    });
  });
});
