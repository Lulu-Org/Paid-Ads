import {
  adAccountConnectResultSchema,
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
    syncRuns: () => getList(syncRunSchema, "/operations/sync-runs"),
  },
};
