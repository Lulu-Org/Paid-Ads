import { z } from "zod";
import { adPlatformSchema } from "./campaign";
import { baseRecordSchema, fractionSchema, idSchema, moneySchema, timestampSchema } from "./common";
import { approvalStatusSchema } from "./library";
import { adsRoleSchema } from "./team";

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
  // Tell Finance (reviewers) before the limit is reached.
  notifyBeforeLimit: z.boolean(),
  // Spend so far this month, computed.
  used: moneySchema,
});
export const spendLimitUpdateSchema = spendLimitSchema.pick({ monthly: true, alertAt: true, notifyBeforeLimit: true });

// What needs a second review (design: "Approval policy"), who approves, and from which amount.
export const approvalScopeSchema = z.enum(["budget_and_launch", "all_changes", "creative_only", "none"]);
export const approvalPolicySchema = z.object({
  scope: approvalScopeSchema,
  threshold: moneySchema,
  approverRole: adsRoleSchema.exclude(["analyst"]),
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

// POST /approvals: ask for an approval (e.g. from the launch checklist).
export const approvalRequestCreateSchema = z.object({
  kind: approvalKindSchema,
  campaignId: idSchema.nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
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

export const syncStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "retry_queued"]);
// What a sync moved (design: "Sync jobs").
export const syncScopeSchema = z.enum(["campaign_performance", "audiences", "conversion_events", "creatives"]);

export const syncRunSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  adAccountId: idSchema,
  platform: adPlatformSchema,
  // sync = provider → Lulu, push = Lulu → provider, both = audiences kept in step both ways.
  kind: z.enum(["sync", "push", "both"]),
  scope: syncScopeSchema,
  status: syncStatusSchema,
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  recordsProcessed: z.number().int().min(0),
  error: z.string().nullable(),
});

// Something that failed and needs a retry or a person (design: "Incidents and retries").
export const incidentKindSchema = z.enum(["rate_limited", "consent_review", "auth_expired", "sync_failed"]);
export const incidentSchema = z.object({
  id: idSchema,
  platform: adPlatformSchema,
  kind: incidentKindSchema,
  // What it is about, e.g. "Offline conversion event" or an audience name (data, shown as is).
  subject: z.string().min(1),
  // When the automatic retry runs; null = a person has to act.
  retryAt: timestampSchema.nullable(),
});

// Events the platforms sent us (design: "Webhook events").
export const webhookEventSchema = z.object({
  id: idSchema,
  platform: adPlatformSchema,
  eventType: z.string().min(1),
  campaignId: idSchema.nullable(),
  receivedAt: timestampSchema,
});

// GET /operations.
export const operationsSummarySchema = z.object({
  healthy: z.boolean(),
  providers: z.number().int().min(0),
  lastSyncAt: timestampSchema.nullable(),
  jobsToday: z.number().int().min(0),
  // Share of today's jobs that succeeded, 0 to 1.
  successRate: z.number().min(0).max(1),
  incidents: z.array(incidentSchema),
  webhooks: z.array(webhookEventSchema),
  // Share of records where Lulu and the platform agree (spend, conversions, status), 0 to 1.
  reconciled: z.number().min(0).max(1),
});

// ---------- Billing ----------

export const paymentMethodSchema = z.object({
  status: z.enum(["active", "missing", "failed"]),
  // Only the brand and last four digits; card details stay with the payment provider.
  brand: z.string().nullable(),
  last4: z.string().regex(/^\d{4}$/).nullable(),
});

export const statementSchema = z.object({
  id: idSchema,
  // "2026-06"
  month: z.string().regex(/^\d{4}-\d{2}$/),
  platform: adPlatformSchema,
  amount: moneySchema,
  status: z.enum(["paid", "due", "failed"]),
  downloadUrl: z.url().nullable(),
});

export type ApprovalScope = z.infer<typeof approvalScopeSchema>;
export type ApprovalRequestCreateInput = z.input<typeof approvalRequestCreateSchema>;
export type SyncScope = z.infer<typeof syncScopeSchema>;
export type IncidentKind = z.infer<typeof incidentKindSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type OperationsSummary = z.infer<typeof operationsSummarySchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type Statement = z.infer<typeof statementSchema>;
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
