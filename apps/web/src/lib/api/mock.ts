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
  CampaignListItem,
  CampaignListQuery,
  ConversionEvent,
  ConversionEventCreateInput,
  LoginInput,
  SyncRun,
} from "@lulu/shared";
import { approvalRequestCreateSchema, campaignTotals, launchChecklist } from "@lulu/shared";
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
  demoMetricDays,
  demoCampaignDefaults,
  demoConversionEvents,
  demoSyncRuns,
  demoTrackingHealth,
  demoUsers,
} from "./fixtures";
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
  demoCampaigns.reduce((sum, c) => sum + campaignTotals(demoMetricDays[c.id] ?? [], c.budget).spend.amount, 0);

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
      const rows: CampaignListItem[] = demoCampaigns
        .filter((c) => (!query.platform || c.platform === query.platform) && (!query.status || c.status === query.status))
        .map((c) => ({ ...c, totals: campaignTotals(demoMetricDays[c.id] ?? [], c.budget) }));
      return delay(paginate(rows, query.page, query.pageSize));
    },
    async checklist(id: string) {
      const campaign = demoCampaigns.find((c) => c.id === id);
      if (!campaign) throw new ApiError("NOT_FOUND", 404);
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
