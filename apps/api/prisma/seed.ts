import { Prisma } from '../src/generated/prisma/client';
import { db, disconnectDb } from '../src/db/prisma';
import { env } from '../src/config/env';
import { hashPassword } from '../src/services/auth';
import {
  SEED_AD_ACCOUNT_IDS,
  SEED_ALEX_ID,
  SEED_APPROVAL_POLICY_ID,
  SEED_AUDIENCE_IDS,
  SEED_AUTOMATION_ACTIVITY_IDS,
  SEED_AUTOMATION_RULE_IDS,
  SEED_CAMPAIGN_DEFAULTS_SETTING_ID,
  SEED_CAMPAIGN_IDS,
  SEED_CONVERSION_EVENT_IDS,
  SEED_CREATIVE_IDS,
  SEED_INCIDENT_IDS,
  SEED_JAMIE_ID,
  SEED_PAYMENT_METHOD_ID,
  SEED_SAMIRA_ID,
  SEED_SPEND_LIMIT_ID,
  SEED_STATEMENT_IDS,
  SEED_SYNC_RUN_IDS,
  SEED_WEBHOOK_EVENT_IDS,
  SEED_WORKSPACE_ID,
  seedUuid,
} from './seed-ids';

// The demo workspace with the design's sample data (MagicPath "Lulu Paid Ads"). Every row has a
// fixed id or natural key and is upserted, so running the seed twice adds nothing. Money is written
// as Decimal with two decimals; the numbers match apps/web/src/lib/api/fixtures.ts.

const CREATED = new Date('2026-10-01T09:00:00.000Z');
const LAST_SYNC = new Date('2026-10-28T08:52:00.000Z');

const money = (amount: number) => new Prisma.Decimal(amount.toFixed(2));

type WithId<T> = T & { id: string };

const workspace: WithId<Prisma.WorkspaceUncheckedCreateInput> = {
  id: SEED_WORKSPACE_ID,
  name: 'Lulu demo',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
};

const users: WithId<Prisma.UserUncheckedCreateInput>[] = [
  {
    id: SEED_JAMIE_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Jamie Morgan',
    email: 'jamie.morgan@lulu.test',
    role: 'owner',
  },
  {
    id: SEED_ALEX_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Alex Rivera',
    email: 'alex.rivera@lulu.test',
    role: 'member',
  },
  {
    id: SEED_SAMIRA_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Samira Khan',
    email: 'samira.khan@lulu.test',
    role: 'admin',
  },
];

const adAccounts: WithId<Prisma.AdAccountUncheckedCreateInput>[] = [
  {
    id: SEED_AD_ACCOUNT_IDS.googleAds,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'google_ads',
    externalId: 'account_google_ads_ext',
    name: 'Lulu Growth · 123-456',
    currency: 'EUR',
    status: 'connected',
    scopes: ['read', 'manage'],
    lastSyncAt: LAST_SYNC,
  },
  {
    id: SEED_AD_ACCOUNT_IDS.googleLsa,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'google_lsa',
    externalId: 'account_google_lsa_ext',
    name: 'Lulu Berlin Local',
    currency: 'EUR',
    status: 'connected',
    scopes: ['read', 'manage'],
    lastSyncAt: LAST_SYNC,
  },
  {
    id: SEED_AD_ACCOUNT_IDS.meta,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'meta_ads',
    externalId: 'account_meta_ext',
    name: 'Lulu Studio Business',
    currency: 'EUR',
    status: 'connected',
    scopes: ['read', 'manage'],
    lastSyncAt: LAST_SYNC,
  },
  {
    id: SEED_AD_ACCOUNT_IDS.linkedin,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'linkedin_ads',
    externalId: 'account_linkedin_ext',
    name: 'Lulu Intelligence Page',
    currency: 'EUR',
    status: 'disconnected',
    scopes: [],
  },
];

const campaigns: WithId<Prisma.CampaignUncheckedCreateInput>[] = [
  {
    id: SEED_CAMPAIGN_IDS.springBerlin,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.googleAds,
    platform: 'google_ads',
    externalId: 'g_1001',
    name: 'Spring launch · Berlin',
    status: 'live',
    objective: 'Qualified lead generation',
    audienceSummary: 'Berlin · Decision makers · 25–54',
    startAt: new Date('2026-06-01T00:00:00.000Z'),
    endAt: new Date('2026-06-30T23:59:59.000Z'),
    budgetAmount: money(6000),
    budgetCurrency: 'EUR',
    rationale:
      'Search demand is strongest for high-intent terms around the spring launch. The campaign is connected to CRM attribution so lead quality can be reviewed beyond the click.',
    nextStep:
      'Review search terms and shift 8% of spend into the two highest-converting ad groups.',
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_CAMPAIGN_IDS.localCalls,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.googleLsa,
    platform: 'google_lsa',
    externalId: 'lsa_2001',
    name: 'Local service calls',
    status: 'live',
    objective: 'Local phone calls',
    audienceSummary: 'Service area · 25 km radius',
    startAt: new Date('2026-06-01T00:00:00.000Z'),
    budgetAmount: money(3000),
    budgetCurrency: 'EUR',
    rationale:
      'Local Services is producing reliable call volume in the service area. The current signal is stable, so the campaign is kept live while the lead response time is improved.',
    nextStep: 'Connect the missed-call workflow and compare booked jobs against raw calls.',
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_CAMPAIGN_IDS.studioAwareness,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.meta,
    platform: 'meta_ads',
    externalId: 'm_3001',
    name: 'Studio awareness',
    status: 'live',
    objective: 'Awareness and lead capture',
    audienceSummary: 'Lookalike · Website visitors · 1%',
    startAt: new Date('2026-06-08T00:00:00.000Z'),
    endAt: new Date('2026-07-08T23:59:59.000Z'),
    budgetAmount: money(4500),
    budgetCurrency: 'EUR',
    rationale:
      'Meta is delivering the lowest cost per lead while the short-form creative receives strong engagement. The budget recommendation is based on qualified lead rate, not only volume.',
    nextStep:
      'Scale the winning video concept by 12% and keep the control creative for comparison.',
    ownerId: SEED_ALEX_ID,
  },
  {
    id: SEED_CAMPAIGN_IDS.b2bQ4,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'linkedin_ads',
    name: 'B2B pipeline · Q4',
    status: 'draft',
    objective: 'B2B pipeline creation',
    audienceSummary: 'Operations leaders · DACH · 50–500 employees',
    startAt: new Date('2026-10-01T00:00:00.000Z'),
    endAt: new Date('2026-12-31T23:59:59.000Z'),
    budgetAmount: money(2500),
    budgetCurrency: 'EUR',
    rationale:
      'The draft is planned around the Q4 buying cycle and is waiting for final creative approval before launch.',
    nextStep: 'Approve the case study asset and define the CRM lead score threshold.',
    ownerId: SEED_ALEX_ID,
  },
];

interface MetricTotals {
  impressions: number;
  clicks: number;
  leads: number;
  calls?: number;
  spend: number;
  revenue: number;
}

/**
 * Daily rows that add up exactly to a campaign's totals in the design, rising a little over the days
 * so the sparklines have a shape. Copied from the web fixtures (the Docker build does not include
 * apps/web); the last day takes any rounding remainder.
 */
function spreadMetricDays(
  campaignKey: string,
  campaignId: string,
  start: string,
  count: number,
  totals: MetricTotals,
): WithId<Prisma.CampaignMetricDayUncheckedCreateInput>[] {
  const weights = Array.from({ length: count }, (_, i) => 0.8 + (0.4 * i) / Math.max(1, count - 1));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const cents = (n: number) => Math.round(n * 100) / 100;
  const share = (total: number, i: number, round: (n: number) => number, used: number): number =>
    i === count - 1 ? round(total - used) : round((total * weights[i]!) / sumWeights);
  const used = { impressions: 0, clicks: 0, leads: 0, calls: 0, spend: 0, revenue: 0 };

  return weights.map((_, i) => {
    const row = {
      impressions: share(totals.impressions, i, Math.round, used.impressions),
      clicks: share(totals.clicks, i, Math.round, used.clicks),
      leads: share(totals.leads, i, Math.round, used.leads),
      calls: share(totals.calls ?? 0, i, Math.round, used.calls),
      spend: share(totals.spend, i, cents, used.spend),
      revenue: share(totals.revenue, i, cents, used.revenue),
    };
    used.impressions += row.impressions;
    used.clicks += row.clicks;
    used.leads += row.leads;
    used.calls += row.calls;
    used.spend = cents(used.spend + row.spend);
    used.revenue = cents(used.revenue + row.revenue);
    const date = new Date(Date.parse(`${start}T00:00:00.000Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      id: seedUuid(`${campaignKey}:metric:${date}`),
      workspaceId: SEED_WORKSPACE_ID,
      campaignId,
      date: new Date(`${date}T00:00:00.000Z`),
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.leads,
      leads: row.leads,
      calls: row.calls,
      spendAmount: money(row.spend),
      revenueAmount: money(row.revenue),
      currency: 'EUR',
    };
  });
}

const metricDays: WithId<Prisma.CampaignMetricDayUncheckedCreateInput>[] = [
  ...spreadMetricDays('campaign_spring_berlin', SEED_CAMPAIGN_IDS.springBerlin, '2026-06-01', 30, {
    impressions: 412800,
    clicks: 18400,
    leads: 184,
    spend: 4280,
    revenue: 20480,
  }),
  ...spreadMetricDays('campaign_local_calls', SEED_CAMPAIGN_IDS.localCalls, '2026-06-01', 30, {
    impressions: 86100,
    clicks: 7800,
    leads: 96,
    calls: 96,
    spend: 1940,
    revenue: 11520,
  }),
  ...spreadMetricDays(
    'campaign_studio_awareness',
    SEED_CAMPAIGN_IDS.studioAwareness,
    '2026-06-08',
    30,
    { impressions: 628400, clicks: 31700, leads: 231, spend: 2660, revenue: 18920 },
  ),
];

type PlanStepSeed = [label: string, detail: string, status: 'done' | 'current' | 'upcoming'];

function planSteps(
  campaignKey: string,
  campaignId: string,
  list: PlanStepSeed[],
): WithId<Prisma.CampaignPlanStepUncheckedCreateInput>[] {
  return list.map(([label, detail, status], order) => ({
    id: seedUuid(`${campaignKey}:step:${order + 1}`),
    workspaceId: SEED_WORKSPACE_ID,
    campaignId,
    order,
    label,
    detail,
    status,
  }));
}

const campaignPlanSteps: WithId<Prisma.CampaignPlanStepUncheckedCreateInput>[] = [
  ...planSteps('campaign_spring_berlin', SEED_CAMPAIGN_IDS.springBerlin, [
    ['Strategy approved', 'Goal and attribution defined', 'done'],
    ['Audience and keywords', '12 ad groups active', 'done'],
    ['Creative test', 'Variant B is leading', 'current'],
    ['Budget review', 'Next review in 3 days', 'upcoming'],
    ['Monthly report', 'Due 30 Jun', 'upcoming'],
  ]),
  ...planSteps('campaign_local_calls', SEED_CAMPAIGN_IDS.localCalls, [
    ['Service area', 'Berlin + 25 km', 'done'],
    ['Lead verification', '96 calls reviewed', 'done'],
    ['Response workflow', 'CRM handoff pending', 'current'],
    ['Quality review', 'Next review in 5 days', 'upcoming'],
  ]),
  ...planSteps('campaign_studio_awareness', SEED_CAMPAIGN_IDS.studioAwareness, [
    ['Audience build', 'Lookalike refreshed', 'done'],
    ['Creative test', 'Video concept A leads', 'done'],
    ['Budget scaling', '12% recommendation', 'current'],
    ['Attribution check', 'Review CRM quality', 'upcoming'],
  ]),
  ...planSteps('campaign_b2b_q4', SEED_CAMPAIGN_IDS.b2bQ4, [
    ['Campaign brief', 'Goal and audience defined', 'done'],
    ['Creative approval', 'Waiting on case study', 'current'],
    ['CRM scoring', 'Threshold not set', 'upcoming'],
    ['Launch', 'Planned for 1 Oct', 'upcoming'],
  ]),
];

const creative = (
  id: string,
  name: string,
  type: string,
  meta: Prisma.InputJsonValue,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
): WithId<Prisma.CreativeUncheckedCreateInput> => ({
  id,
  workspaceId: SEED_WORKSPACE_ID,
  name,
  type,
  meta,
  approvalStatus,
  approvedById: approvalStatus === 'approved' ? SEED_JAMIE_ID : null,
});

const creatives: WithId<Prisma.CreativeUncheckedCreateInput>[] = [
  creative(SEED_CREATIVE_IDS.springRsa, 'Spring launch · Search RSA', 'search_ad', {
    headlines: 4,
    descriptions: 3,
  }),
  creative(SEED_CREATIVE_IDS.berlinLanding, 'Berlin landing page', 'landing_page', {
    version: 3,
    quality: 0.92,
  }),
  creative(SEED_CREATIVE_IDS.offerExtension, 'Offer extension', 'extension', { adGroups: 6 }),
  creative(SEED_CREATIVE_IDS.lsaProfile, 'Verified business profile', 'profile', {
    rating: 4.9,
    reviews: 38,
  }),
  creative(SEED_CREATIVE_IDS.callScript, 'Call script', 'document', { teammates: 3 }),
  creative(SEED_CREATIVE_IDS.studioWalkthrough, 'Studio walkthrough', 'video', {
    seconds: 15,
    completion: 0.91,
  }),
  creative(SEED_CREATIVE_IDS.beforeAfter, 'Before / after carousel', 'carousel', {
    cards: 6,
    saveRate: 0.038,
  }),
  creative(SEED_CREATIVE_IDS.studioForm, 'Lead form · Studio', 'lead_form', { fields: 6 }),
  creative(
    SEED_CREATIVE_IDS.opsCaseStudy,
    'Operations case study',
    'document',
    { format: 'PDF' },
    'pending',
  ),
  creative(SEED_CREATIVE_IDS.linkedinForm, 'Lead gen form', 'lead_form', { fields: 7 }, 'pending'),
];

interface CampaignCreativeSeed {
  campaignKey: string;
  campaignId: string;
  creativeKeys: string[];
}

const campaignCreativeSeeds: CampaignCreativeSeed[] = [
  {
    campaignKey: 'campaign_spring_berlin',
    campaignId: SEED_CAMPAIGN_IDS.springBerlin,
    creativeKeys: ['creative_spring_rsa', 'creative_berlin_landing', 'creative_offer_extension'],
  },
  {
    campaignKey: 'campaign_local_calls',
    campaignId: SEED_CAMPAIGN_IDS.localCalls,
    creativeKeys: ['creative_lsa_profile', 'creative_call_script'],
  },
  {
    campaignKey: 'campaign_studio_awareness',
    campaignId: SEED_CAMPAIGN_IDS.studioAwareness,
    creativeKeys: ['creative_studio_walkthrough', 'creative_before_after', 'creative_studio_form'],
  },
  {
    campaignKey: 'campaign_b2b_q4',
    campaignId: SEED_CAMPAIGN_IDS.b2bQ4,
    creativeKeys: ['creative_ops_case_study', 'creative_linkedin_form'],
  },
];

const campaignCreatives: WithId<Prisma.CampaignCreativeUncheckedCreateInput>[] =
  campaignCreativeSeeds.flatMap(({ campaignKey, campaignId, creativeKeys }) =>
    creativeKeys.map((creativeKey, index) => ({
      id: seedUuid(`${campaignKey}:creative:${creativeKey}`),
      workspaceId: SEED_WORKSPACE_ID,
      campaignId,
      creativeId: seedUuid(creativeKey),
      variant: String.fromCharCode(65 + index),
    })),
  );

const audiences: WithId<Prisma.AudienceUncheckedCreateInput>[] = [
  {
    id: SEED_AUDIENCE_IDS.website30d,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Website visitors · 30 days',
    source: 'website_visitors',
    sizeEstimate: 42810,
    consentBasis: 'Visitors from Lulu Online Presence',
    platforms: ['google_ads', 'meta_ads'],
    lastSyncedAt: LAST_SYNC,
  },
  {
    id: SEED_AUDIENCE_IDS.crmQualified,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'CRM · Qualified leads',
    source: 'crm_segment',
    sizeEstimate: 8420,
    consentBasis: 'Contacts with an active sales stage',
    platforms: ['google_ads', 'meta_ads', 'linkedin_ads'],
    lastSyncedAt: LAST_SYNC,
  },
  {
    id: SEED_AUDIENCE_IDS.lookalikeStudio,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Lookalike · Studio buyers',
    source: 'lookalike',
    sizeEstimate: 1200000,
    consentBasis: 'Modeled from 2,140 converted leads',
    platforms: ['meta_ads'],
    lastSyncedAt: null,
  },
];

const conversionEvents: WithId<Prisma.ConversionEventUncheckedCreateInput>[] = [
  {
    id: SEED_CONVERSION_EVENT_IDS.qualifiedLead,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Qualified lead',
    source: 'crm',
    valueAmount: money(120),
    valueCurrency: 'EUR',
    platforms: ['google_ads', 'meta_ads', 'linkedin_ads'],
    health: 'mapped',
    lastReceivedAt: new Date('2026-10-28T08:58:00.000Z'),
  },
  {
    id: SEED_CONVERSION_EVENT_IDS.bookedConsultation,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Booked consultation',
    source: 'calendar',
    valueAmount: money(340),
    valueCurrency: 'EUR',
    platforms: ['google_ads', 'google_lsa'],
    health: 'mapped',
    lastReceivedAt: new Date('2026-10-28T08:49:00.000Z'),
  },
  {
    id: SEED_CONVERSION_EVENT_IDS.offlineSale,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Offline sale',
    source: 'accounting',
    valueAmount: null,
    valueCurrency: null,
    platforms: ['google_ads', 'meta_ads'],
    health: 'needs_attention',
    lastReceivedAt: new Date('2026-10-27T16:20:00.000Z'),
  },
];

const automationRules: WithId<Prisma.AutomationRuleUncheckedCreateInput>[] = [
  {
    id: SEED_AUTOMATION_RULE_IDS.protectCpl,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Protect target CPL',
    trigger: { platforms: ['google_ads', 'meta_ads'], schedule: null },
    condition: { metric: 'cpl', operator: 'above', value: 28, window: { amount: 3, unit: 'days' } },
    action: 'recommend',
    enabled: true,
  },
  {
    id: SEED_AUTOMATION_RULE_IDS.weeklyDigest,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Weekly performance digest',
    // Every Monday at 08:00 UTC.
    trigger: { platforms: [], schedule: '0 8 * * 1' },
    condition: Prisma.DbNull,
    action: 'send_digest',
    enabled: true,
  },
  {
    id: SEED_AUTOMATION_RULE_IDS.trackingFailure,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Pause on tracking failure',
    trigger: { platforms: [], schedule: null },
    condition: {
      metric: 'leads',
      operator: 'below',
      value: 1,
      window: { amount: 12, unit: 'hours' },
    },
    action: 'pause_campaign',
    enabled: false,
  },
];

const automationActivities: WithId<Prisma.AutomationActivityUncheckedCreateInput>[] = [
  {
    id: SEED_AUTOMATION_ACTIVITY_IDS.reviewRequested,
    workspaceId: SEED_WORKSPACE_ID,
    ruleId: SEED_AUTOMATION_RULE_IDS.protectCpl,
    outcome: 'review_requested',
    campaignId: SEED_CAMPAIGN_IDS.studioAwareness,
    at: new Date('2026-10-28T08:52:00.000Z'),
  },
  {
    id: SEED_AUTOMATION_ACTIVITY_IDS.digestSent,
    workspaceId: SEED_WORKSPACE_ID,
    ruleId: SEED_AUTOMATION_RULE_IDS.weeklyDigest,
    outcome: 'digest_sent',
    campaignId: null,
    at: new Date('2026-10-27T08:00:00.000Z'),
  },
];

const campaignDefaults: WithId<Prisma.SettingUncheckedCreateInput> = {
  id: SEED_CAMPAIGN_DEFAULTS_SETTING_ID,
  workspaceId: SEED_WORKSPACE_ID,
  key: 'campaignDefaults',
  value: { consentRequired: true, autoTagLinks: true, policyValidation: true },
};

const spendLimit: WithId<Prisma.SpendLimitUncheckedCreateInput> = {
  id: SEED_SPEND_LIMIT_ID,
  workspaceId: SEED_WORKSPACE_ID,
  monthlyAmount: money(16000),
  currency: 'EUR',
  alertAt: 0.8,
  notifyBeforeLimit: true,
};

const approvalPolicy: WithId<Prisma.ApprovalPolicyUncheckedCreateInput> = {
  id: SEED_APPROVAL_POLICY_ID,
  workspaceId: SEED_WORKSPACE_ID,
  scope: 'budget_and_launch',
  thresholdAmount: money(2500),
  currency: 'EUR',
  approverRole: 'reviewer',
};

const paymentMethod: WithId<Prisma.PaymentMethodUncheckedCreateInput> = {
  id: SEED_PAYMENT_METHOD_ID,
  workspaceId: SEED_WORKSPACE_ID,
  status: 'active',
  brand: 'Visa',
  last4: '2488',
};

const statements: WithId<Prisma.StatementUncheckedCreateInput>[] = [
  {
    id: SEED_STATEMENT_IDS.googleJune,
    workspaceId: SEED_WORKSPACE_ID,
    month: '2026-06',
    platform: 'google_ads',
    amountAmount: money(4280),
    currency: 'EUR',
    status: 'paid',
  },
  {
    id: SEED_STATEMENT_IDS.metaJune,
    workspaceId: SEED_WORKSPACE_ID,
    month: '2026-06',
    platform: 'meta_ads',
    amountAmount: money(2660),
    currency: 'EUR',
    status: 'paid',
  },
];

const incidents: WithId<Prisma.IncidentUncheckedCreateInput>[] = [
  {
    id: SEED_INCIDENT_IDS.linkedinConversion,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'linkedin_ads',
    kind: 'rate_limited',
    subject: 'Offline conversion event',
    retryAt: new Date('2026-10-28T09:04:00.000Z'),
  },
  {
    id: SEED_INCIDENT_IDS.metaAudience,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'meta_ads',
    kind: 'consent_review',
    subject: 'Lookalike · Studio buyers',
  },
];

const webhookEvents: WithId<Prisma.WebhookEventUncheckedCreateInput>[] = [
  {
    id: SEED_WEBHOOK_EVENT_IDS.googleCampaignUpdated,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'google_ads',
    eventType: 'campaign.updated',
    campaignId: SEED_CAMPAIGN_IDS.springBerlin,
    receivedAt: new Date('2026-10-28T08:52:00.000Z'),
  },
  {
    id: SEED_WEBHOOK_EVENT_IDS.metaLeadCreated,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'meta_ads',
    eventType: 'lead.created',
    campaignId: SEED_CAMPAIGN_IDS.studioAwareness,
    receivedAt: new Date('2026-10-28T08:48:00.000Z'),
  },
  {
    id: SEED_WEBHOOK_EVENT_IDS.linkedinConversionRetrying,
    workspaceId: SEED_WORKSPACE_ID,
    platform: 'linkedin_ads',
    eventType: 'conversion.retrying',
    campaignId: SEED_CAMPAIGN_IDS.b2bQ4,
    receivedAt: new Date('2026-10-28T08:38:00.000Z'),
  },
];

const syncRuns: WithId<Prisma.SyncRunUncheckedCreateInput>[] = [
  {
    id: SEED_SYNC_RUN_IDS.googleAds,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.googleAds,
    platform: 'google_ads',
    kind: 'sync',
    scope: 'campaign_performance',
    status: 'succeeded',
    startedAt: new Date('2026-10-28T08:51:00.000Z'),
    finishedAt: new Date('2026-10-28T08:52:00.000Z'),
    recordsProcessed: 428,
  },
  {
    id: SEED_SYNC_RUN_IDS.meta,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.meta,
    platform: 'meta_ads',
    kind: 'both',
    scope: 'audiences',
    status: 'succeeded',
    startedAt: new Date('2026-10-28T08:48:00.000Z'),
    finishedAt: new Date('2026-10-28T08:49:00.000Z'),
    recordsProcessed: 3,
  },
  {
    id: SEED_SYNC_RUN_IDS.linkedin,
    workspaceId: SEED_WORKSPACE_ID,
    adAccountId: SEED_AD_ACCOUNT_IDS.linkedin,
    platform: 'linkedin_ads',
    kind: 'push',
    scope: 'conversion_events',
    status: 'retry_queued',
    startedAt: new Date('2026-10-28T08:38:00.000Z'),
    recordsProcessed: 0,
    error: 'RATE_LIMITED',
  },
];

const teamMembers: WithId<Prisma.TeamMemberUncheckedCreateInput>[] = [
  {
    id: seedUuid('team:user_jamie'),
    workspaceId: SEED_WORKSPACE_ID,
    userId: SEED_JAMIE_ID,
    adsRole: 'owner',
    title: 'Workspace owner',
    channelScope: 'all',
    canApproveCreatives: true,
    invitedAt: CREATED,
    joinedAt: CREATED,
  },
  {
    id: seedUuid('team:user_alex'),
    workspaceId: SEED_WORKSPACE_ID,
    userId: SEED_ALEX_ID,
    adsRole: 'editor',
    title: 'Performance marketer',
    channelScope: 'all',
    canApproveCreatives: true,
    invitedAt: CREATED,
    joinedAt: CREATED,
  },
  {
    id: seedUuid('team:user_samira'),
    workspaceId: SEED_WORKSPACE_ID,
    userId: SEED_SAMIRA_ID,
    adsRole: 'reviewer',
    title: 'Finance reviewer',
    channelScope: 'reports_only',
    canApproveCreatives: false,
    invitedAt: CREATED,
    joinedAt: CREATED,
  },
];

async function upsertMany<T extends { id: string }>(
  rows: T[],
  upsert: (id: string, data: Omit<T, 'id'>, create: T) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    const { id, ...data } = row;
    await upsert(id, data, row);
  }
}

// Passwords are hashed fresh on every run (new salt), so the seed stays
// idempotent: the same users, each with a non-null passwordHash.
async function usersWithPasswords(): Promise<WithId<Prisma.UserUncheckedCreateInput>[]> {
  return Promise.all(
    users.map(async (user) => ({
      ...user,
      passwordHash: await hashPassword(
        user.id === SEED_JAMIE_ID ? env.SEED_OWNER_PASSWORD : env.SEED_MEMBER_PASSWORD,
      ),
    })),
  );
}

export async function runSeed(): Promise<void> {
  await upsertMany([workspace], (id, data, create) =>
    db.workspace.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(await usersWithPasswords(), (id, data, create) =>
    db.user.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(adAccounts, (id, data, create) =>
    db.adAccount.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(campaigns, (id, data, create) =>
    db.campaign.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(metricDays, (_id, data, create) =>
    db.campaignMetricDay.upsert({
      where: {
        workspaceId_campaignId_date: {
          workspaceId: data.workspaceId,
          campaignId: data.campaignId,
          date: data.date,
        },
      },
      update: data,
      create,
    }),
  );
  await upsertMany(campaignPlanSteps, (id, data, create) =>
    db.campaignPlanStep.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(creatives, (id, data, create) =>
    db.creative.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(campaignCreatives, (id, data, create) =>
    db.campaignCreative.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(audiences, (id, data, create) =>
    db.audience.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(conversionEvents, (id, data, create) =>
    db.conversionEvent.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(automationRules, (id, data, create) =>
    db.automationRule.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(automationActivities, (id, data, create) =>
    db.automationActivity.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany([campaignDefaults], (_id, data, create) =>
    db.setting.upsert({
      where: { workspaceId_key: { workspaceId: data.workspaceId, key: data.key } },
      update: data,
      create,
    }),
  );
  await upsertMany([spendLimit], (_id, data, create) =>
    db.spendLimit.upsert({
      where: { workspaceId: data.workspaceId },
      update: data,
      create,
    }),
  );
  await upsertMany([approvalPolicy], (_id, data, create) =>
    db.approvalPolicy.upsert({
      where: { workspaceId: data.workspaceId },
      update: data,
      create,
    }),
  );
  await upsertMany([paymentMethod], (id, data, create) =>
    db.paymentMethod.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(statements, (id, data, create) =>
    db.statement.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(incidents, (id, data, create) =>
    db.incident.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(webhookEvents, (id, data, create) =>
    db.webhookEvent.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(syncRuns, (id, data, create) =>
    db.syncRun.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(teamMembers, (_id, data, create) =>
    db.teamMember.upsert({
      where: { workspaceId_userId: { workspaceId: data.workspaceId, userId: data.userId } },
      update: data,
      create,
    }),
  );

  console.log('Workspaces: 1');
  console.log(`Users: ${users.length}`);
  console.log(`Ad accounts: ${adAccounts.length}`);
  console.log(`Campaigns: ${campaigns.length}`);
  console.log(`Campaign metric days: ${metricDays.length}`);
  console.log(`Campaign plan steps: ${campaignPlanSteps.length}`);
  console.log(`Creatives: ${creatives.length}`);
  console.log(`Campaign creatives: ${campaignCreatives.length}`);
  console.log(`Audiences: ${audiences.length}`);
  console.log(`Conversion events: ${conversionEvents.length}`);
  console.log(`Automation rules: ${automationRules.length}`);
  console.log(`Automation activities: ${automationActivities.length}`);
  console.log('Settings: 1 (campaignDefaults)');
  console.log(`Spend limits: 1`);
  console.log(`Approval policies: 1`);
  console.log(`Team members: ${teamMembers.length}`);
  console.log(`Payment methods: 1`);
  console.log(`Statements: ${statements.length}`);
  console.log(`Incidents: ${incidents.length}`);
  console.log(`Webhook events: ${webhookEvents.length}`);
  console.log(`Sync runs: ${syncRuns.length}`);
  console.log('Approval requests: 0');
  console.log('Reports: 0');
  console.log('Seed complete');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /prisma[\\/]seed\.(ts|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  runSeed()
    .catch((err: unknown) => {
      console.error('Seed failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
