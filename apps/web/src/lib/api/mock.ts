import type {
  AdPlatform,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRequestCreateInput,
  SpendLimitUpdateInput,
  TeamInviteInput,
  TeamMember,
  TeamMemberUpdateInput,
  AttributionModel,
  AuthSession,
  AutomationRule,
  AutomationRuleCreateInput,
  AutomationRuleUpdateInput,
  CampaignDefaults,
  Campaign,
  CampaignCreateInput,
  AudienceCreateInput,
  AudienceListItem,
  CreativeListItem,
  CreativeTest,
  CreativeType,
  PlanScenarioCreateInput,
  Planning,
  Report,
  ReportCreateInput,
  ReportRunQuery,
  CampaignDetail,
  CampaignListItem,
  CampaignListQuery,
  ConversionEvent,
  ConversionEventCreateInput,
  LoginInput,
  SyncRun,
} from "@lulu/shared";
import { approvalRequestCreateSchema, audienceCreateSchema, buildOverview, buildPlanning, buildReport, channelHistory, creativeCreateSchema, planScenarioCreateSchema, reportCreateSchema, reportRunQuerySchema, campaignCreateSchema, campaignTotals, launchChecklist } from "@lulu/shared";
import {
  DEMO_WORKSPACE_ID,
  demoAdAccounts,
  demoApprovalPolicy,
  demoApprovals,
  demoAudiences,
  demoCampaignCreatives,
  demoCreatives,
  demoOperations,
  demoPaymentMethod,
  demoSpendLimit,
  demoStatements,
  demoTeam,
  demoAttribution,
  demoAutomationActivity,
  demoAutomationRules,
  demoCampaigns,
  demoPlans,
  demoMetricDays,
  demoCampaignDefaults,
  demoConversionEvents,
  demoSyncRuns,
  demoTrackingHealth,
  demoUsers,
} from "./fixtures";
import { demoAudienceExtras, demoBudgetPlan, demoPreviousTargetLeads, demoReports, demoVariantResults } from "./fixtures-f2";
import { ApiError, type ListResult } from "./types";

// The same shape as real.ts, answered from the design's sample data.

const CURRENT_USER_ID = "user_jamie";

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150));
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function paginate<T>(rows: T[], page = 1, pageSize = 25): ListResult<T> {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), meta: { page, pageSize, total: rows.length } };
}

// Copies, so changes in one test or session do not leak into the fixtures.
const db = {
  audiences: demoAudiences.map((a) => ({ ...a, ...demoAudienceExtras[a.id], syncing: a.lastSyncedAt === null })),
  creatives: demoCreatives.map((c) => ({ ...c })),
  plan: demoBudgetPlan(),
  reports: demoReports.map((r) => ({ ...r })),
  campaigns: demoCampaigns.map((c) => ({ ...c })),
  adAccounts: demoAdAccounts.map((a) => ({ ...a })),
  events: demoConversionEvents.map((e) => ({ ...e })),
  rules: demoAutomationRules.map((r) => ({ ...r })),
  activity: [...demoAutomationActivity],
  defaults: { ...demoCampaignDefaults },
  syncRuns: [...demoSyncRuns],
  approvals: [...demoApprovals],
  spendLimit: { ...demoSpendLimit },
  policy: { ...demoApprovalPolicy },
  team: demoTeam.map((m) => ({ ...m })),
  operations: { ...demoOperations, incidents: [...demoOperations.incidents] },
};

// Spend so far this month: the campaigns' spend in the sample data.
const usedThisMonth = () =>
  db.campaigns.reduce((sum, c) => sum + campaignTotals(demoMetricDays[c.id] ?? [], c.budget).spend.amount, 0);

function findMember(userId: string) {
  const member = db.team.find((m) => m.userId === userId);
  if (!member) throw new ApiError("NOT_FOUND", 404);
  return member;
}

const record = () => ({ workspaceId: DEMO_WORKSPACE_ID, createdAt: now(), updatedAt: now(), deletedAt: null });

function findRule(id: string) {
  const rule = db.rules.find((r) => r.id === id);
  if (!rule) throw new ApiError("NOT_FOUND", 404);
  return rule;
}

function planningFor(plan: typeof db.plan) {
  return buildPlanning(plan, db.spendLimit.monthly, channelHistory(db.campaigns, demoMetricDays, "EUR"), demoPreviousTargetLeads);
}

function findCampaign(id: string) {
  const campaign = db.campaigns.find((c) => c.id === id && c.deletedAt === null);
  if (!campaign) throw new ApiError("NOT_FOUND", 404);
  return campaign;
}

function setStatus(id: string, from: Campaign["status"], to: Campaign["status"]) {
  const campaign = findCampaign(id);
  if (campaign.status !== from) throw new ApiError("CAMPAIGN_STATUS_CONFLICT", 409);
  Object.assign(campaign, { status: to, updatedAt: now() });
  return { ...campaign };
}

export const mockApi = {
  auth: {
    async login(input: LoginInput): Promise<AuthSession> {
      const user = demoUsers.find((u) => u.email === input.email.trim().toLowerCase());
      if (!user || !input.password) throw new ApiError("UNAUTHORIZED", 401);
      return delay({ token: `mock-${user.id}`, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    },
    async logout() {
      return delay(undefined);
    },
  },

  me: () => delay(demoUsers.find((u) => u.id === CURRENT_USER_ID)!),
  users: () => delay(paginate(demoUsers)),

  campaigns: {
    list(query: Partial<CampaignListQuery> = {}) {
      const rows: CampaignListItem[] = db.campaigns
        .filter((c) => (!query.platform || c.platform === query.platform) && (!query.status || c.status === query.status))
        .map((c) => ({ ...c, totals: campaignTotals(demoMetricDays[c.id] ?? [], c.budget) }));
      return delay(paginate(rows, query.page, query.pageSize));
    },
    async get(id: string): Promise<CampaignDetail> {
      const campaign = findCampaign(id);
      const days = demoMetricDays[id] ?? [];
      return delay({
        ...campaign,
        totals: campaignTotals(days, campaign.budget),
        plan: demoPlans[id] ?? [],
        creativeIds: demoCampaignCreatives[id] ?? [],
        days,
      });
    },
    async create(input: CampaignCreateInput): Promise<Campaign> {
      const parsed = campaignCreateSchema.parse(input);
      const campaign: Campaign = {
        ...record(),
        id: newId("campaign"),
        adAccountId: parsed.adAccountId ?? db.adAccounts.find((a) => a.platform === parsed.platform)?.id ?? null,
        platform: parsed.platform,
        externalId: null,
        name: parsed.name,
        status: "draft",
        objective: parsed.objective,
        audienceSummary: parsed.audienceSummary ?? null,
        startAt: parsed.startAt ?? null,
        endAt: parsed.endAt ?? null,
        budget: parsed.budget,
        rationale: parsed.rationale ?? null,
        nextStep: parsed.nextStep ?? null,
        ownerId: parsed.ownerId ?? CURRENT_USER_ID,
      };
      db.campaigns.unshift(campaign);
      return delay(campaign);
    },
    // The real API queues ads.push; the mock changes the status straight away.
    async pause(id: string): Promise<Campaign> {
      return delay(setStatus(id, "live", "paused"));
    },
    async resume(id: string): Promise<Campaign> {
      return delay(setStatus(id, "paused", "live"));
    },
    async checklist(id: string) {
      const campaign = findCampaign(id);
      const creativeIds = demoCampaignCreatives[id] ?? [];
      return delay(
        launchChecklist({
          campaign,
          account: db.adAccounts.find((a) => a.id === campaign.adAccountId) ?? null,
          creatives: demoCreatives.filter((c) => creativeIds.includes(c.id)),
          audiences: demoAudiences,
          trackingHealthy: demoTrackingHealth.healthy,
          defaults: db.defaults,
          policy: db.policy,
          approvals: db.approvals,
        }),
      );
    },
  },

  creatives: {
    list(): Promise<ListResult<CreativeListItem>> {
      const rows = db.creatives.map((c) => ({
        ...c,
        campaignCount: Object.values(demoCampaignCreatives).filter((ids) => ids.includes(c.id)).length,
        winning: demoVariantResults.some((v) => v.creativeId === c.id && v.role === "winner"),
      }));
      return delay(paginate(rows, 1, 100));
    },
    // The real API takes multipart/form-data; the mock keeps the name and type and has no file URL.
    async create(input: { name: string; type: CreativeType; file: File | null }) {
      const parsed = creativeCreateSchema.parse({ name: input.name, type: input.type });
      const creative = { ...record(), id: newId("creative"), ...parsed, fileUrl: null, meta: parsed.meta ?? {}, approvalStatus: "pending" as const, approvedById: null };
      db.creatives.unshift(creative);
      return delay(creative);
    },
    tests(): Promise<CreativeTest[]> {
      const byCampaign = Object.groupBy(demoVariantResults, (v) => v.campaignId);
      return delay(
        Object.entries(byCampaign).map(([campaignId, variants]) => {
          const rows = variants!.map((v) => ({
            variant: v.variant,
            creativeId: v.creativeId,
            creativeName: db.creatives.find((c) => c.id === v.creativeId)?.name ?? v.creativeId,
            role: v.role,
            spend: { amount: v.spend, currency: "EUR" },
            leads: v.leads,
            cpl: v.leads ? { amount: Math.round((v.spend / v.leads) * 100) / 100, currency: "EUR" } : null,
          }));
          const control = rows.find((r) => r.role === "control")?.cpl;
          const winner = rows.find((r) => r.role === "winner")?.cpl;
          return {
            campaignId,
            campaignName: db.campaigns.find((c) => c.id === campaignId)?.name ?? campaignId,
            variants: rows,
            winnerLead: control && winner ? (control.amount - winner.amount) / control.amount : null,
          };
        }),
      );
    },
  },

  audiences: {
    list(): Promise<ListResult<AudienceListItem>> {
      const rows = db.audiences
        .filter((a) => a.deletedAt === null)
        .map(({ campaignIds, ...a }) => ({ ...a, campaignCount: campaignIds.length }));
      return delay(paginate(rows, 1, 100));
    },
    async create(input: AudienceCreateInput) {
      const parsed = audienceCreateSchema.parse(input);
      const audience = {
        ...record(),
        id: newId("audience"),
        ...parsed,
        sizeEstimate: null,
        lastSyncedAt: null,
        description: null,
        matchRate: null,
        exclusions: [],
        campaignIds: [] as string[],
        syncing: true,
      };
      db.audiences.unshift(audience);
      return delay(audience);
    },
    // The real API queues the sync job; the mock finishes it straight away.
    async sync(id: string) {
      const audience = db.audiences.find((a) => a.id === id);
      if (!audience) throw new ApiError("NOT_FOUND", 404);
      Object.assign(audience, { syncing: false, lastSyncedAt: now() });
      return delay(undefined);
    },
  },

  planning: {
    get: (): Promise<Planning> => delay(planningFor(db.plan)),
    async saveScenario(input: PlanScenarioCreateInput): Promise<Planning> {
      const parsed = planScenarioCreateSchema.parse(input);
      const channels = db.plan.channels.map((c) => ({ ...c, planned: parsed.channels.find((p) => p.platform === c.platform)?.planned ?? c.planned }));
      db.plan = { ...db.plan, name: parsed.name, channels, status: "draft", updatedAt: now() };
      return delay(planningFor(db.plan));
    },
  },

  reports: {
    list: () => delay(paginate(db.reports.filter((r) => r.deletedAt === null))),
    async create(input: ReportCreateInput): Promise<Report> {
      const report = { ...record(), id: newId("report"), ...reportCreateSchema.parse(input) };
      db.reports.unshift(report);
      return delay(report);
    },
    async remove(id: string) {
      const report = db.reports.find((r) => r.id === id);
      if (!report) throw new ApiError("NOT_FOUND", 404);
      report.deletedAt = now();
      return delay(undefined);
    },
    run: (query: ReportRunQuery) =>
      delay(buildReport({ campaigns: db.campaigns, days: demoMetricDays, currency: "EUR" }, reportRunQuerySchema.parse(query))),
  },

  overview: {
    get: (rangeDays = 30) =>
      delay(
        buildOverview({
          campaigns: db.campaigns,
          days: demoMetricDays,
          accounts: db.adAccounts,
          currency: "EUR",
          rangeDays,
          today: new Date(),
        }),
      ),
  },

  approvals: {
    list: () => delay(paginate(db.approvals)),
    async request(input: ApprovalRequestCreateInput): Promise<ApprovalRequest> {
      const parsed = approvalRequestCreateSchema.parse(input);
      const open = db.approvals.find((a) => a.kind === parsed.kind && a.campaignId === parsed.campaignId && a.status === "pending");
      if (open) return delay(open);
      const request: ApprovalRequest = {
        ...record(),
        id: newId("approval"),
        ...parsed,
        status: "pending",
        requestedById: CURRENT_USER_ID,
        decidedById: null,
        decidedAt: null,
      };
      db.approvals.push(request);
      return delay(request);
    },
  },

  billing: {
    spendLimit: () => delay({ ...db.spendLimit, used: { amount: usedThisMonth(), currency: db.spendLimit.monthly.currency } }),
    async updateSpendLimit(input: SpendLimitUpdateInput) {
      db.spendLimit = { ...input };
      return mockApi.billing.spendLimit();
    },
    approvalPolicy: () => delay({ ...db.policy }),
    async updateApprovalPolicy(input: ApprovalPolicy) {
      db.policy = { ...input };
      return delay({ ...db.policy });
    },
    paymentMethod: () => delay({ ...demoPaymentMethod }),
    statements: () => delay(paginate(demoStatements)),
  },

  team: {
    list: () => delay(paginate(db.team)),
    async invite(input: TeamInviteInput): Promise<TeamMember> {
      const email = input.email.trim().toLowerCase();
      if (db.team.some((m) => m.email === email)) throw new ApiError("CONFLICT", 409);
      const member: TeamMember = { ...input, userId: newId("user"), name: email, email, title: null, invited: true };
      db.team.push(member);
      return delay(member);
    },
    async update(userId: string, input: TeamMemberUpdateInput) {
      const member = findMember(userId);
      if (member.adsRole === "owner") throw new ApiError("FORBIDDEN", 403);
      Object.assign(member, input);
      return delay({ ...member });
    },
  },

  adAccounts: {
    list: () => delay(paginate(db.adAccounts)),
    // The real API returns the platform's sign-in page; the mock connects straight away.
    async connect(platform: AdPlatform) {
      const account = db.adAccounts.find((a) => a.platform === platform);
      if (account) Object.assign(account, { status: "connected", scopes: ["read", "manage"], lastSyncAt: now() });
      return delay({ authorizeUrl: `https://example.com/oauth/${platform}` });
    },
    async sync(id: string): Promise<SyncRun> {
      const account = db.adAccounts.find((a) => a.id === id);
      if (!account) throw new ApiError("NOT_FOUND", 404);
      account.lastSyncAt = now();
      const run: SyncRun = {
        id: newId("sync"),
        workspaceId: DEMO_WORKSPACE_ID,
        adAccountId: id,
        platform: account.platform,
        kind: "sync",
        scope: "campaign_performance",
        status: "succeeded",
        startedAt: now(),
        finishedAt: now(),
        recordsProcessed: 0,
        error: null,
      };
      db.syncRuns.unshift(run);
      return delay(run);
    },
  },

  tracking: {
    health: () => delay({ ...demoTrackingHealth }),
    events: () => delay(paginate(db.events)),
    async createEvent(input: ConversionEventCreateInput): Promise<ConversionEvent> {
      const event: ConversionEvent = { ...record(), id: newId("event"), ...input, health: "mapped", lastReceivedAt: null };
      db.events.push(event);
      return delay(event);
    },
  },

  attribution: {
    // The sample data has one set of numbers; the chosen model is echoed back.
    get: (model: AttributionModel = "data_driven") => delay({ ...demoAttribution, model }),
  },

  automations: {
    list: () => delay(paginate(db.rules)),
    activity: () => delay(paginate(db.activity)),
    async create(input: AutomationRuleCreateInput): Promise<AutomationRule> {
      const rule: AutomationRule = { ...record(), id: newId("rule"), ...input };
      db.rules.push(rule);
      return delay(rule);
    },
    async update(id: string, input: AutomationRuleUpdateInput) {
      const rule = findRule(id);
      Object.assign(rule, input, { updatedAt: now() });
      return delay({ ...rule });
    },
  },

  campaignDefaults: {
    get: () => delay({ ...db.defaults }),
    async update(input: CampaignDefaults) {
      db.defaults = { ...input };
      return delay({ ...db.defaults });
    },
  },

  operations: {
    summary: () => delay({ ...db.operations, incidents: [...db.operations.incidents] }),
    syncRuns: () => delay(paginate(db.syncRuns)),
    // The retry runs straight away in the mock and clears the incident.
    async retry(incidentId: string) {
      if (!db.operations.incidents.some((i) => i.id === incidentId)) throw new ApiError("NOT_FOUND", 404);
      db.operations.incidents = db.operations.incidents.filter((i) => i.id !== incidentId);
      return delay(undefined);
    },
    reconcile: () => delay({ ...db.operations, incidents: [...db.operations.incidents] }),
  },
};
