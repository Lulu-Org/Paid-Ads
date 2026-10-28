import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, moneySchema, timestampSchema } from "./common";

// Ad platforms, accounts, campaigns and their metrics (docs/data-model.md, docs/api.md "Campaigns").
// The UI translates enum values (platforms.<key>, campaignStatus.<key>, ...).

export const adPlatforms = ["google_lsa", "google_ads", "meta_ads", "linkedin_ads"] as const;
export const adPlatformSchema = z.enum(adPlatforms);

export const connectionStatusSchema = z.enum(["connected", "needs_attention", "disconnected"]);
export const campaignStatusSchema = z.enum(["draft", "live", "paused", "ended"]);
export const planStepStatusSchema = z.enum(["done", "current", "upcoming"]);

// ---------- Ad accounts ----------

// The token never leaves the API, so it is not part of this shape.
export const adAccountSchema = baseRecordSchema.extend({
  platform: adPlatformSchema,
  externalId: z.string().min(1),
  name: z.string().trim().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: connectionStatusSchema,
  scopes: z.array(z.string()),
  lastSyncAt: timestampSchema.nullable(),
  lastError: z.string().nullable(),
});

export const adAccountConnectSchema = z.object({ platform: adPlatformSchema });
export const adAccountConnectResultSchema = z.object({ authorizeUrl: z.url() });

// ---------- Campaigns ----------

export const campaignSchema = baseRecordSchema.extend({
  adAccountId: idSchema.nullable(),
  platform: adPlatformSchema,
  // Null until the campaign is pushed to the platform.
  externalId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(200),
  status: campaignStatusSchema,
  objective: z.string().trim().min(1).max(200),
  audienceSummary: z.string().trim().max(300).nullable(),
  startAt: timestampSchema.nullable(),
  // Null = always on.
  endAt: timestampSchema.nullable(),
  budget: moneySchema,
  // The design's "Why this campaign" and "Next step".
  rationale: z.string().max(2000).nullable(),
  nextStep: z.string().max(1000).nullable(),
  ownerId: idSchema,
});

// The numbers shown for a campaign, computed from its metric days (metrics.ts). CTR, CPL and ROAS are
// null when they cannot be computed (no impressions, no leads, no spend).
export const campaignTotalsSchema = z.object({
  spend: moneySchema,
  revenue: moneySchema,
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  conversions: z.number().int().min(0),
  leads: z.number().int().min(0),
  ctr: z.number().min(0).nullable(),
  cpl: moneySchema.nullable(),
  roas: z.number().min(0).nullable(),
  // Spend ÷ budget, 0 to 1 (capped).
  progress: z.number().min(0).max(1),
});

export const campaignListItemSchema = campaignSchema.extend({ totals: campaignTotalsSchema });

export const campaignPlanStepSchema = z.object({
  id: idSchema,
  order: z.number().int().min(0),
  label: z.string().trim().min(1).max(200),
  detail: z.string().max(300),
  status: planStepStatusSchema,
});

export const campaignMetricDaySchema = z.object({
  date: z.iso.date(),
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  conversions: z.number().int().min(0),
  leads: z.number().int().min(0),
  spend: moneySchema,
  revenue: moneySchema,
});

// GET /campaigns/:id. `creatives` are ids; the creative library has the details.
export const campaignDetailSchema = campaignListItemSchema.extend({
  plan: z.array(campaignPlanStepSchema),
  creativeIds: z.array(idSchema),
  days: z.array(campaignMetricDaySchema),
});

// POST /campaigns creates a draft. The owner defaults to the current user.
export const campaignCreateSchema = z.object({
  platform: adPlatformSchema,
  adAccountId: idSchema.nullable().optional(),
  name: campaignSchema.shape.name,
  objective: campaignSchema.shape.objective,
  audienceSummary: campaignSchema.shape.audienceSummary.optional(),
  startAt: timestampSchema.nullable().optional(),
  endAt: timestampSchema.nullable().optional(),
  budget: moneySchema.refine((m) => m.amount > 0, "budgetPositive"),
  rationale: campaignSchema.shape.rationale.optional(),
  nextStep: campaignSchema.shape.nextStep.optional(),
  ownerId: idSchema.optional(),
});

// PATCH /campaigns/:id. The platform cannot change after creation.
export const campaignUpdateSchema = campaignCreateSchema.omit({ platform: true }).partial();

export const campaignListQuerySchema = listQuerySchema.extend({
  platform: adPlatformSchema.optional(),
  status: campaignStatusSchema.optional(),
});

export const campaignPlanUpdateSchema = z.object({
  steps: z.array(campaignPlanStepSchema.omit({ id: true, order: true })).max(20),
});

// GET /campaigns/:id/checklist (design: Launch Checklist).
export const checklistItemKeySchema = z.enum([
  "account_connected",
  "budget_set",
  "schedule_set",
  "audience_set",
  "creative_approved",
  "tracking_ready",
  "consent_checked",
  "landing_page_ready",
  "approval_granted",
  "owner_assigned",
]);
export const checklistItemSchema = z.object({ key: checklistItemKeySchema, passed: z.boolean() });
export const campaignChecklistSchema = z.object({
  items: z.array(checklistItemSchema),
  passed: z.number().int().min(0),
  total: z.number().int().min(0),
});

export type AdPlatform = z.infer<typeof adPlatformSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type PlanStepStatus = z.infer<typeof planStepStatusSchema>;
export type AdAccount = z.infer<typeof adAccountSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignTotals = z.infer<typeof campaignTotalsSchema>;
export type CampaignListItem = z.infer<typeof campaignListItemSchema>;
export type CampaignPlanStep = z.infer<typeof campaignPlanStepSchema>;
export type CampaignMetricDay = z.infer<typeof campaignMetricDaySchema>;
export type CampaignDetail = z.infer<typeof campaignDetailSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;
export type CampaignPlanUpdateInput = z.infer<typeof campaignPlanUpdateSchema>;
export type ChecklistItemKey = z.infer<typeof checklistItemKeySchema>;
export type CampaignChecklist = z.infer<typeof campaignChecklistSchema>;
