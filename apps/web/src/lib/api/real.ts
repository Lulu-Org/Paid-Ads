import {
  adAccountConnectResultSchema,
  approvalPolicySchema,
  approvalRequestSchema,
  campaignChecklistSchema,
  campaignDetailSchema,
  campaignSchema,
  overviewSchema,
  creativeSchema,
  type CampaignCreateInput,
  operationsSummarySchema,
  paymentMethodSchema,
  spendLimitSchema,
  statementSchema,
  teamMemberSchema,
  type ApprovalPolicy,
  type ApprovalRequestCreateInput,
  type SpendLimitUpdateInput,
  type TeamInviteInput,
  type TeamMemberUpdateInput,
  campaignListItemSchema,
  type CampaignListQuery,
  adAccountSchema,
  attributionSchema,
  authSessionSchema,
  automationActivitySchema,
  automationRuleSchema,
  campaignDefaultsSchema,
  conversionEventSchema,
  syncRunSchema,
  trackingHealthSchema,
  userSchema,
  type AdPlatform,
  type AttributionModel,
  type AutomationRuleCreateInput,
  type AutomationRuleUpdateInput,
  type CampaignDefaults,
  type ConversionEventCreateInput,
  type LoginInput,
} from "@lulu/shared";
import { getList, getOne, post, write } from "./http";

// Endpoints from docs/api.md. Keep the same shape as mock.ts.
export const realApi = {
  auth: {
    login: (input: LoginInput) => write(authSessionSchema, "POST", "/auth/login", input),
    logout: () => post("/auth/logout"),
  },

  me: () => getOne(userSchema, "/me"),
  users: () => getList(userSchema, "/users"),

  campaigns: {
    list: (query: Partial<CampaignListQuery> = {}) => getList(campaignListItemSchema, "/campaigns", query),
    get: (id: string) => getOne(campaignDetailSchema, `/campaigns/${id}`),
    create: (input: CampaignCreateInput) => write(campaignSchema, "POST", "/campaigns", input),
    pause: (id: string) => write(campaignSchema, "POST", `/campaigns/${id}/pause`, {}),
    resume: (id: string) => write(campaignSchema, "POST", `/campaigns/${id}/resume`, {}),
    checklist: (id: string) => getOne(campaignChecklistSchema, `/campaigns/${id}/checklist`),
  },

  creatives: {
    list: () => getList(creativeSchema, "/creatives", { pageSize: 100 }),
  },

  overview: {
    get: (rangeDays = 30) => getOne(overviewSchema, "/overview", { rangeDays }),
  },

  approvals: {
    list: () => getList(approvalRequestSchema, "/approvals"),
    request: (input: ApprovalRequestCreateInput) => write(approvalRequestSchema, "POST", "/approvals", input),
  },

  billing: {
    spendLimit: () => getOne(spendLimitSchema, "/spend-limit"),
    updateSpendLimit: (input: SpendLimitUpdateInput) => write(spendLimitSchema, "PUT", "/spend-limit", input),
    approvalPolicy: () => getOne(approvalPolicySchema, "/approval-policy"),
    updateApprovalPolicy: (input: ApprovalPolicy) => write(approvalPolicySchema, "PUT", "/approval-policy", input),
    paymentMethod: () => getOne(paymentMethodSchema, "/billing/payment-method"),
    statements: () => getList(statementSchema, "/billing/statements"),
  },

  team: {
    list: () => getList(teamMemberSchema, "/team"),
    invite: (input: TeamInviteInput) => write(teamMemberSchema, "POST", "/team/invitations", input),
    update: (userId: string, input: TeamMemberUpdateInput) =>
      write(teamMemberSchema, "PATCH", `/team/${userId}`, input),
  },

  adAccounts: {
    list: () => getList(adAccountSchema, "/ad-accounts"),
    connect: (platform: AdPlatform) =>
      write(adAccountConnectResultSchema, "POST", "/ad-accounts/connect", { platform }),
    sync: (id: string) => write(syncRunSchema, "POST", `/ad-accounts/${id}/sync`, {}),
  },

  tracking: {
    health: () => getOne(trackingHealthSchema, "/tracking/health"),
    events: () => getList(conversionEventSchema, "/conversion-events"),
    createEvent: (input: ConversionEventCreateInput) =>
      write(conversionEventSchema, "POST", "/conversion-events", input),
  },

  attribution: {
    get: (model?: AttributionModel) => getOne(attributionSchema, "/attribution", model ? { model } : undefined),
  },

  automations: {
    list: () => getList(automationRuleSchema, "/automations"),
    activity: () => getList(automationActivitySchema, "/automations/activity"),
    create: (input: AutomationRuleCreateInput) => write(automationRuleSchema, "POST", "/automations", input),
    update: (id: string, input: AutomationRuleUpdateInput) =>
      write(automationRuleSchema, "PATCH", `/automations/${id}`, input),
  },

  campaignDefaults: {
    get: () => getOne(campaignDefaultsSchema, "/campaign-defaults"),
    update: (input: CampaignDefaults) => write(campaignDefaultsSchema, "PUT", "/campaign-defaults", input),
  },

  operations: {
    summary: () => getOne(operationsSummarySchema, "/operations"),
    syncRuns: () => getList(syncRunSchema, "/operations/sync-runs"),
    retry: (incidentId: string) => post(`/operations/incidents/${incidentId}/retry`),
    reconcile: () => write(operationsSummarySchema, "POST", "/operations/reconcile", {}),
  },
};
