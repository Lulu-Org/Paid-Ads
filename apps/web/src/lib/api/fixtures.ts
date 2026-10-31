import type {
  AdAccount,
  ApprovalPolicy,
  Audience,
  Attribution,
  AutomationActivity,
  ApprovalRequest,
  AutomationRule,
  CampaignDefaults,
  Campaign,
  CampaignMetricDay,
  CampaignPlanStep,
  ConversionEvent,
  Creative,
  OperationsSummary,
  PaymentMethod,
  Statement,
  SyncRun,
  TeamMember,
  TrackingHealth,
  User,
} from "@lulu/shared";

// Sample data from the MagicPath design ("Lulu Paid Ads", design/LuluPaidAds.tsx), so the web app runs
// without the API (AGENTS.md rule 5). Names and totals are the design's; the API seed (task B1) uses
// the same ids and numbers.

export const DEMO_WORKSPACE_ID = "workspace_demo";
const CREATED = "2026-10-01T09:00:00.000Z";
const base = { workspaceId: DEMO_WORKSPACE_ID, createdAt: CREATED, updatedAt: CREATED, deletedAt: null };
const eur = (amount: number) => ({ amount, currency: "EUR" });

export const demoUsers: User[] = [
  { ...base, id: "user_jamie", name: "Jamie Morgan", email: "jamie@lulu.demo", role: "owner", language: "en" },
  { ...base, id: "user_alex", name: "Alex Rivera", email: "alex@lulu.demo", role: "member", language: "en" },
  { ...base, id: "user_samira", name: "Samira Khan", email: "samira@lulu.demo", role: "admin", language: "en" },
];

// ---------- Ad accounts (design: Integrations; LinkedIn is not connected yet) ----------

const account = (id: string, platform: AdAccount["platform"], name: string, lastSyncAt: string | null): AdAccount => ({
  ...base,
  id,
  platform,
  externalId: `${id}_ext`,
  name,
  currency: "EUR",
  status: lastSyncAt ? "connected" : "disconnected",
  scopes: lastSyncAt ? ["read", "manage"] : [],
  lastSyncAt,
  lastError: null,
});

export const demoAdAccounts: AdAccount[] = [
  account("account_google_ads", "google_ads", "Lulu Growth · 123-456", "2026-10-28T08:52:00.000Z"),
  account("account_google_lsa", "google_lsa", "Lulu Berlin Local", "2026-10-28T08:52:00.000Z"),
  account("account_meta", "meta_ads", "Lulu Studio Business", "2026-10-28T08:52:00.000Z"),
  account("account_linkedin", "linkedin_ads", "Lulu Intelligence Page", null),
];

// ---------- Campaigns ----------

export const demoCampaigns: Campaign[] = [
  {
    ...base,
    id: "campaign_spring_berlin",
    adAccountId: "account_google_ads",
    platform: "google_ads",
    externalId: "g_1001",
    name: "Spring launch · Berlin",
    status: "live",
    objective: "Qualified lead generation",
    audienceSummary: "Berlin · Decision makers · 25–54",
    startAt: "2026-06-01T00:00:00.000Z",
    endAt: "2026-06-30T23:59:59.000Z",
    budget: eur(6000),
    rationale:
      "Search demand is strongest for high-intent terms around the spring launch. The campaign is connected to CRM attribution so lead quality can be reviewed beyond the click.",
    nextStep: "Review search terms and shift 8% of spend into the two highest-converting ad groups.",
    ownerId: "user_jamie",
  },
  {
    ...base,
    id: "campaign_local_calls",
    adAccountId: "account_google_lsa",
    platform: "google_lsa",
    externalId: "lsa_2001",
    name: "Local service calls",
    status: "live",
    objective: "Local phone calls",
    audienceSummary: "Service area · 25 km radius",
    startAt: "2026-06-01T00:00:00.000Z",
    endAt: null,
    budget: eur(3000),
    rationale:
      "Local Services is producing reliable call volume in the service area. The current signal is stable, so the campaign is kept live while the lead response time is improved.",
    nextStep: "Connect the missed-call workflow and compare booked jobs against raw calls.",
    ownerId: "user_jamie",
  },
  {
    ...base,
    id: "campaign_studio_awareness",
    adAccountId: "account_meta",
    platform: "meta_ads",
    externalId: "m_3001",
    name: "Studio awareness",
    status: "live",
    objective: "Awareness and lead capture",
    audienceSummary: "Lookalike · Website visitors · 1%",
    startAt: "2026-06-08T00:00:00.000Z",
    endAt: "2026-07-08T23:59:59.000Z",
    budget: eur(4500),
    rationale:
      "Meta is delivering the lowest cost per lead while the short-form creative receives strong engagement. The budget recommendation is based on qualified lead rate, not only volume.",
    nextStep: "Scale the winning video concept by 12% and keep the control creative for comparison.",
    ownerId: "user_alex",
  },
  {
    ...base,
    id: "campaign_b2b_q4",
    adAccountId: null,
    platform: "linkedin_ads",
    externalId: null,
    name: "B2B pipeline · Q4",
    status: "draft",
    objective: "B2B pipeline creation",
    audienceSummary: "Operations leaders · DACH · 50–500 employees",
    startAt: "2026-10-01T00:00:00.000Z",
    endAt: "2026-12-31T23:59:59.000Z",
    budget: eur(2500),
    rationale: "The draft is planned around the Q4 buying cycle and is waiting for final creative approval before launch.",
    nextStep: "Approve the case study asset and define the CRM lead score threshold.",
    ownerId: "user_alex",
  },
];

/**
 * Daily rows that add up exactly to a campaign's totals in the design, rising a little over the days so
 * the sparklines have a shape. The last day takes any rounding remainder.
 */
export function spreadDays(
  start: string,
  count: number,
  totals: { impressions: number; clicks: number; leads: number; calls?: number; spend: number; revenue: number },
): CampaignMetricDay[] {
  const weights = Array.from({ length: count }, (_, i) => 0.8 + (0.4 * i) / Math.max(1, count - 1));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const cents = (n: number) => Math.round(n * 100) / 100;
  const share = (total: number, i: number, round: (n: number) => number, used: number) =>
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
    const date = new Date(Date.parse(`${start}T00:00:00.000Z`) + i * 86_400_000).toISOString().slice(0, 10);
    return {
      date,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.leads,
      leads: row.leads,
      calls: row.calls,
      spend: eur(row.spend),
      revenue: eur(row.revenue),
    };
  });
}

// Totals from the design: impressions, clicks, leads (= conversions), spend, revenue.
export const demoMetricDays: Record<string, CampaignMetricDay[]> = {
  campaign_spring_berlin: spreadDays("2026-06-01", 30, { impressions: 412800, clicks: 18400, leads: 184, spend: 4280, revenue: 20480 }),
  campaign_local_calls: spreadDays("2026-06-01", 30, { impressions: 86100, clicks: 7800, leads: 96, calls: 96, spend: 1940, revenue: 11520 }),
  campaign_studio_awareness: spreadDays("2026-06-08", 30, { impressions: 628400, clicks: 31700, leads: 231, spend: 2660, revenue: 18920 }),
  campaign_b2b_q4: [],
};

const steps = (id: string, list: [string, string, CampaignPlanStep["status"]][]): CampaignPlanStep[] =>
  list.map(([label, detail, status], order) => ({ id: `${id}_step_${order + 1}`, order, label, detail, status }));

export const demoPlans: Record<string, CampaignPlanStep[]> = {
  campaign_spring_berlin: steps("campaign_spring_berlin", [
    ["Strategy approved", "Goal and attribution defined", "done"],
    ["Audience and keywords", "12 ad groups active", "done"],
    ["Creative test", "Variant B is leading", "current"],
    ["Budget review", "Next review in 3 days", "upcoming"],
    ["Monthly report", "Due 30 Jun", "upcoming"],
  ]),
  campaign_local_calls: steps("campaign_local_calls", [
    ["Service area", "Berlin + 25 km", "done"],
    ["Lead verification", "96 calls reviewed", "done"],
    ["Response workflow", "CRM handoff pending", "current"],
    ["Quality review", "Next review in 5 days", "upcoming"],
  ]),
  campaign_studio_awareness: steps("campaign_studio_awareness", [
    ["Audience build", "Lookalike refreshed", "done"],
    ["Creative test", "Video concept A leads", "done"],
    ["Budget scaling", "12% recommendation", "current"],
    ["Attribution check", "Review CRM quality", "upcoming"],
  ]),
  campaign_b2b_q4: steps("campaign_b2b_q4", [
    ["Campaign brief", "Goal and audience defined", "done"],
    ["Creative approval", "Waiting on case study", "current"],
    ["CRM scoring", "Threshold not set", "upcoming"],
    ["Launch", "Planned for 1 Oct", "upcoming"],
  ]),
};

// ---------- Creatives (the design's campaign assets) ----------

const creative = (
  id: string,
  name: string,
  type: Creative["type"],
  meta: Creative["meta"],
  approvalStatus: Creative["approvalStatus"] = "approved",
): Creative => ({
  ...base,
  id,
  name,
  type,
  fileUrl: null,
  meta,
  approvalStatus,
  approvedById: approvalStatus === "approved" ? "user_jamie" : null,
});

export const demoCreatives: Creative[] = [
  creative("creative_spring_rsa", "Spring launch · Search RSA", "search_ad", { headlines: 4, descriptions: 3 }),
  creative("creative_berlin_landing", "Berlin landing page", "landing_page", { version: 3, quality: 0.92 }),
  creative("creative_offer_extension", "Offer extension", "extension", { adGroups: 6 }),
  creative("creative_lsa_profile", "Verified business profile", "profile", { rating: 4.9, reviews: 38 }),
  creative("creative_call_script", "Call script", "document", { teammates: 3 }),
  creative("creative_studio_walkthrough", "Studio walkthrough", "video", { seconds: 15, completion: 0.91 }),
  creative("creative_before_after", "Before / after carousel", "carousel", { cards: 6, saveRate: 0.038 }),
  creative("creative_studio_form", "Lead form · Studio", "lead_form", { fields: 6 }),
  creative("creative_ops_case_study", "Operations case study", "document", { format: "PDF" }, "pending"),
  creative("creative_linkedin_form", "Lead gen form", "lead_form", { fields: 7 }, "pending"),
];

export const demoCampaignCreatives: Record<string, string[]> = {
  campaign_spring_berlin: ["creative_spring_rsa", "creative_berlin_landing", "creative_offer_extension"],
  campaign_local_calls: ["creative_lsa_profile", "creative_call_script"],
  campaign_studio_awareness: ["creative_studio_walkthrough", "creative_before_after", "creative_studio_form"],
  campaign_b2b_q4: ["creative_ops_case_study", "creative_linkedin_form"],
};

// ---------- Audiences ----------

export const demoAudiences: Audience[] = [
  {
    ...base,
    id: "audience_website_30d",
    name: "Website visitors · 30 days",
    source: "website_visitors",
    sizeEstimate: 42810,
    consentBasis: "Visitors from Lulu Online Presence",
    platforms: ["google_ads", "meta_ads"],
    lastSyncedAt: "2026-10-28T08:52:00.000Z",
  },
  {
    ...base,
    id: "audience_crm_qualified",
    name: "CRM · Qualified leads",
    source: "crm_segment",
    sizeEstimate: 8420,
    consentBasis: "Contacts with an active sales stage",
    platforms: ["google_ads", "meta_ads", "linkedin_ads"],
    lastSyncedAt: "2026-10-28T08:52:00.000Z",
  },
  {
    ...base,
    id: "audience_lookalike_studio",
    name: "Lookalike · Studio buyers",
    source: "lookalike",
    sizeEstimate: 1200000,
    consentBasis: "Modeled from 2,140 converted leads",
    platforms: ["meta_ads"],
    lastSyncedAt: null,
  },
];

// ---------- Tracking ----------

export const demoConversionEvents: ConversionEvent[] = [
  { ...base, id: "event_qualified_lead", name: "Qualified lead", source: "crm", value: eur(120), platforms: ["google_ads", "meta_ads", "linkedin_ads"], health: "mapped", lastReceivedAt: "2026-10-28T08:58:00.000Z" },
  { ...base, id: "event_booked_consultation", name: "Booked consultation", source: "calendar", value: eur(340), platforms: ["google_ads", "google_lsa"], health: "mapped", lastReceivedAt: "2026-10-28T08:49:00.000Z" },
  { ...base, id: "event_offline_sale", name: "Offline sale", source: "accounting", value: null, platforms: ["google_ads", "meta_ads"], health: "needs_attention", lastReceivedAt: "2026-10-27T16:20:00.000Z" },
];

export const demoTrackingHealth: TrackingHealth = { healthy: true, eventsToday: 8420, changeVsYesterday: 0.114, needsAttention: 2 };

// Revenue by platform as in the design (the campaigns' attributed revenue).
export const demoAttribution: Attribution = {
  model: "data_driven",
  dataQuality: 0.986,
  revenue: eur(42640),
  unmappedEvents: 2,
  byPlatform: [
    { platform: "google_ads", revenue: eur(20480) },
    { platform: "meta_ads", revenue: eur(18920) },
    { platform: "google_lsa", revenue: eur(11520) },
  ],
};

// ---------- Automations ----------

export const demoAutomationRules: AutomationRule[] = [
  {
    ...base,
    id: "rule_protect_cpl",
    name: "Protect target CPL",
    trigger: { platforms: ["google_ads", "meta_ads"], schedule: null },
    condition: { metric: "cpl", operator: "above", value: 28, window: { amount: 3, unit: "days" } },
    action: "recommend",
    enabled: true,
  },
  {
    ...base,
    id: "rule_weekly_digest",
    name: "Weekly performance digest",
    // Every Monday at 08:00 UTC.
    trigger: { platforms: [], schedule: "0 8 * * 1" },
    condition: null,
    action: "send_digest",
    enabled: true,
  },
  {
    ...base,
    id: "rule_tracking_failure",
    name: "Pause on tracking failure",
    trigger: { platforms: [], schedule: null },
    condition: { metric: "leads", operator: "below", value: 1, window: { amount: 12, unit: "hours" } },
    action: "pause_campaign",
    enabled: false,
  },
];

export const demoAutomationActivity: AutomationActivity[] = [
  { id: "activity_1", ruleId: "rule_protect_cpl", outcome: "review_requested", campaignId: "campaign_studio_awareness", at: "2026-10-28T08:52:00.000Z" },
  { id: "activity_2", ruleId: "rule_weekly_digest", outcome: "digest_sent", campaignId: null, at: "2026-10-27T08:00:00.000Z" },
];

export const demoCampaignDefaults: CampaignDefaults = { consentRequired: true, autoTagLinks: true, policyValidation: true };

// ---------- Billing & controls ----------

export const demoSpendLimit = { monthly: eur(16000), alertAt: 0.8, notifyBeforeLimit: true };
export const demoApprovalPolicy: ApprovalPolicy = { scope: "budget_and_launch", threshold: eur(2500), approverRole: "reviewer" };

export const demoPaymentMethod: PaymentMethod = { status: "active", brand: "Visa", last4: "2488" };

export const demoStatements: Statement[] = [
  { id: "statement_2026_06_google", month: "2026-06", platform: "google_ads", amount: eur(4280), status: "paid", downloadUrl: null },
  { id: "statement_2026_06_meta", month: "2026-06", platform: "meta_ads", amount: eur(2660), status: "paid", downloadUrl: null },
];

export const demoApprovals: ApprovalRequest[] = [];

// ---------- Team (design: "Team & Permissions") ----------

export const demoTeam: TeamMember[] = [
  { userId: "user_jamie", name: "Jamie Morgan", email: "jamie@lulu.demo", title: "Workspace owner", adsRole: "owner", channelScope: "all", canApproveCreatives: true, invited: false },
  { userId: "user_alex", name: "Alex Rivera", email: "alex@lulu.demo", title: "Performance marketer", adsRole: "editor", channelScope: "all", canApproveCreatives: true, invited: false },
  { userId: "user_samira", name: "Samira Khan", email: "samira@lulu.demo", title: "Finance reviewer", adsRole: "reviewer", channelScope: "reports_only", canApproveCreatives: false, invited: false },
];

// ---------- Operations ----------

// The design's sync jobs, incidents, webhooks and numbers.
export const demoSyncRuns: SyncRun[] = [
  { id: "sync_1", workspaceId: DEMO_WORKSPACE_ID, adAccountId: "account_google_ads", platform: "google_ads", kind: "sync", scope: "campaign_performance", status: "succeeded", startedAt: "2026-10-28T08:51:00.000Z", finishedAt: "2026-10-28T08:52:00.000Z", recordsProcessed: 428, error: null },
  { id: "sync_2", workspaceId: DEMO_WORKSPACE_ID, adAccountId: "account_meta", platform: "meta_ads", kind: "both", scope: "audiences", status: "succeeded", startedAt: "2026-10-28T08:48:00.000Z", finishedAt: "2026-10-28T08:49:00.000Z", recordsProcessed: 3, error: null },
  { id: "sync_3", workspaceId: DEMO_WORKSPACE_ID, adAccountId: "account_linkedin", platform: "linkedin_ads", kind: "push", scope: "conversion_events", status: "retry_queued", startedAt: "2026-10-28T08:38:00.000Z", finishedAt: null, recordsProcessed: 0, error: "RATE_LIMITED" },
];

export const demoOperations: OperationsSummary = {
  healthy: true,
  providers: 4,
  lastSyncAt: "2026-10-28T08:52:00.000Z",
  jobsToday: 1284,
  successRate: 0.996,
  incidents: [
    { id: "incident_linkedin_conversion", platform: "linkedin_ads", kind: "rate_limited", subject: "Offline conversion event", retryAt: "2026-10-28T09:04:00.000Z" },
    { id: "incident_meta_audience", platform: "meta_ads", kind: "consent_review", subject: "Lookalike · Studio buyers", retryAt: null },
  ],
  webhooks: [
    { id: "webhook_1", platform: "google_ads", eventType: "campaign.updated", campaignId: "campaign_spring_berlin", receivedAt: "2026-10-28T08:52:00.000Z" },
    { id: "webhook_2", platform: "meta_ads", eventType: "lead.created", campaignId: "campaign_studio_awareness", receivedAt: "2026-10-28T08:48:00.000Z" },
    { id: "webhook_3", platform: "linkedin_ads", eventType: "conversion.retrying", campaignId: "campaign_b2b_q4", receivedAt: "2026-10-28T08:38:00.000Z" },
  ],
  reconciled: 0.984,
};
