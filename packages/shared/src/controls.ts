import { z } from "zod";
import { adPlatformSchema } from "./campaign";
import { baseRecordSchema, fractionSchema, idSchema, moneySchema, timestampSchema } from "./common";
import { approvalStatusSchema } from "./library";
import { roleSchema } from "./user";

// Automations, spend controls, approvals, reports and sync runs (docs/data-model.md, docs/api.md).

// ---------- Automations ----------

export const automationMetricSchema = z.enum(["cpl", "ctr", "roas", "spend", "leads"]);
export const automationActionSchema = z.enum(["notify", "recommend", "pause_campaign", "shift_budget", "send_digest"]);

export const automationRuleSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  // Checked after each sync for these platforms (empty = all), or on a schedule (cron, UTC) for digests.
  trigger: z.object({ platforms: z.array(adPlatformSchema), schedule: z.string().min(1).nullable() }),
  // e.g. CPL above 28 for 3 days; null for scheduled digests. "hours" covers the design's
  // "no conversion event for 12 hours".
  condition: z
    .object({
      metric: automationMetricSchema,
      operator: z.enum(["above", "below"]),
      value: z.number(),
      window: z.object({ amount: z.number().int().min(1).max(90), unit: z.enum(["hours", "days"]) }),
    })
    .nullable(),
  action: automationActionSchema,
  enabled: z.boolean(),
});

// What a rule did (design: "Recent automation activity").
export const automationActivitySchema = z.object({
  id: idSchema,
  ruleId: idSchema,
  outcome: z.enum(["review_requested", "paused", "notified", "digest_sent", "budget_shifted"]),
  campaignId: idSchema.nullable(),
  at: timestampSchema,
});

export const automationRuleCreateSchema = automationRuleSchema.pick({
  name: true,
  trigger: true,
  condition: true,
  action: true,
  enabled: true,
});
export const automationRuleUpdateSchema = automationRuleCreateSchema.partial();

// ---------- Spend limit and approvals ----------

export const spendLimitSchema = z.object({
  monthly: moneySchema,
  // Alert when this share of the limit is used, e.g. 0.8.
  alertAt: fractionSchema,
  // Spend so far this month, computed.
  used: moneySchema,
});
export const spendLimitUpdateSchema = spendLimitSchema.pick({ monthly: true, alertAt: true });

export const approvalPolicySchema = z.object({
  threshold: moneySchema,
  approverRole: roleSchema,
});

export const approvalKindSchema = z.enum(["budget_change", "launch", "creative"]);

export const approvalRequestSchema = baseRecordSchema.extend({
  kind: approvalKindSchema,
  campaignId: idSchema.nullable(),
  // What is asked, e.g. { budget: { amount: 7500, currency: "EUR" } }.
  payload: z.record(z.string(), z.unknown()),
  status: approvalStatusSchema,
  requestedById: idSchema,
  decidedById: idSchema.nullable(),
  decidedAt: timestampSchema.nullable(),
});

// Guardrails applied to new campaigns (design: Platform Setup, "Defaults"). GET/PUT /campaign-defaults.
export const campaignDefaultsSchema = z.object({
  consentRequired: z.boolean(),
  autoTagLinks: z.boolean(),
  policyValidation: z.boolean(),
});

// ---------- Reports ----------

export const reportSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  view: z.object({
    platforms: z.array(adPlatformSchema),
    rangeDays: z.number().int().min(1).max(366),
    compare: z.enum(["none", "previous_period", "previous_year"]),
  }),
  // Cron in UTC; null = on demand.
  schedule: z.string().min(1).nullable(),
  recipients: z.array(z.email()),
});
export const reportCreateSchema = reportSchema.pick({ name: true, view: true, schedule: true, recipients: true });
export const reportUpdateSchema = reportCreateSchema.partial();

// ---------- Operations ----------

export const syncStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);

export const syncRunSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  adAccountId: idSchema,
  platform: adPlatformSchema,
  kind: z.enum(["sync", "push"]),
  status: syncStatusSchema,
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  recordsProcessed: z.number().int().min(0),
  error: z.string().nullable(),
});

export type AutomationMetric = z.infer<typeof automationMetricSchema>;
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type AutomationRuleCreateInput = z.infer<typeof automationRuleCreateSchema>;
export type AutomationRuleUpdateInput = z.infer<typeof automationRuleUpdateSchema>;
export type AutomationActivity = z.infer<typeof automationActivitySchema>;
export type CampaignDefaults = z.infer<typeof campaignDefaultsSchema>;
export type SpendLimit = z.infer<typeof spendLimitSchema>;
export type SpendLimitUpdateInput = z.infer<typeof spendLimitUpdateSchema>;
export type ApprovalPolicy = z.infer<typeof approvalPolicySchema>;
export type ApprovalKind = z.infer<typeof approvalKindSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type SyncRun = z.infer<typeof syncRunSchema>;
