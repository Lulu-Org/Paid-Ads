import { z } from "zod";
import { adPlatformSchema } from "./campaign";
import { baseRecordSchema, idSchema, listQuerySchema, moneySchema, timestampSchema } from "./common";

// Audiences, creatives and conversion events (docs/data-model.md, docs/api.md "Audiences, creatives, tracking").

// ---------- Audiences ----------

export const audienceSourceSchema = z.enum(["crm_segment", "website_visitors", "customer_list", "lookalike"]);

export const audienceSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  source: audienceSourceSchema,
  sizeEstimate: z.number().int().min(0).nullable(),
  // Why the business may use this audience, e.g. "Marketing consent in CRM".
  consentBasis: z.string().trim().min(1).max(300),
  platforms: z.array(adPlatformSchema),
  lastSyncedAt: timestampSchema.nullable(),
});

export const audienceCreateSchema = z.object({
  name: audienceSchema.shape.name,
  source: audienceSourceSchema,
  consentBasis: audienceSchema.shape.consentBasis,
  platforms: z.array(adPlatformSchema).min(1),
});
export const audienceUpdateSchema = audienceCreateSchema.partial();

// ---------- Creatives ----------

export const creativeTypeSchema = z.enum([
  "search_ad",
  "image",
  "video",
  "carousel",
  "document",
  "lead_form",
  "landing_page",
  "extension",
  "profile",
]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const creativeSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  type: creativeTypeSchema,
  fileUrl: z.url().nullable(),
  // Formats and lengths, e.g. { headlines: 4, descriptions: 3 } or { seconds: 15 }.
  meta: z.record(z.string(), z.union([z.string(), z.number()])),
  approvalStatus: approvalStatusSchema,
  approvedById: idSchema.nullable(),
});

export const creativeCreateSchema = z.object({
  name: creativeSchema.shape.name,
  type: creativeTypeSchema,
  meta: creativeSchema.shape.meta.optional(),
});
export const creativeUpdateSchema = creativeCreateSchema.partial();

// ---------- Conversion events ----------

export const conversionSourceSchema = z.enum(["crm", "calendar", "accounting", "website", "call"]);
export const eventHealthSchema = z.enum(["mapped", "needs_attention"]);

export const conversionEventSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  source: conversionSourceSchema,
  // Null = dynamic: the value comes with each conversion (e.g. an offline sale from accounting).
  value: moneySchema.nullable(),
  platforms: z.array(adPlatformSchema),
  health: eventHealthSchema,
  lastReceivedAt: timestampSchema.nullable(),
});

export const conversionEventCreateSchema = z.object({
  name: conversionEventSchema.shape.name,
  source: conversionSourceSchema,
  value: moneySchema.nullable(),
  platforms: z.array(adPlatformSchema).min(1),
});
export const conversionEventUpdateSchema = conversionEventCreateSchema.partial();

// GET /tracking/health (design: Tracking).
export const trackingHealthSchema = z.object({
  healthy: z.boolean(),
  eventsToday: z.number().int().min(0),
  // Fraction vs. yesterday; null without data.
  changeVsYesterday: z.number().nullable(),
  needsAttention: z.number().int().min(0),
});

// GET /attribution (design: Attribution & Data).
export const attributionModelSchema = z.enum(["data_driven", "last_touch", "first_touch", "linear"]);
export const attributionSchema = z.object({
  model: attributionModelSchema,
  // Share of conversion events mapped to a business outcome, 0 to 1.
  dataQuality: z.number().min(0).max(1),
  revenue: moneySchema,
  unmappedEvents: z.number().int().min(0),
  byPlatform: z.array(z.object({ platform: adPlatformSchema, revenue: moneySchema })),
});

export const libraryListQuerySchema = listQuerySchema.extend({ platform: adPlatformSchema.optional() });

export type AudienceSource = z.infer<typeof audienceSourceSchema>;
export type Audience = z.infer<typeof audienceSchema>;
export type AudienceCreateInput = z.infer<typeof audienceCreateSchema>;
export type AudienceUpdateInput = z.infer<typeof audienceUpdateSchema>;
export type CreativeType = z.infer<typeof creativeTypeSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type Creative = z.infer<typeof creativeSchema>;
export type CreativeCreateInput = z.infer<typeof creativeCreateSchema>;
export type CreativeUpdateInput = z.infer<typeof creativeUpdateSchema>;
export type ConversionSource = z.infer<typeof conversionSourceSchema>;
export type ConversionEvent = z.infer<typeof conversionEventSchema>;
export type ConversionEventCreateInput = z.infer<typeof conversionEventCreateSchema>;
export type ConversionEventUpdateInput = z.infer<typeof conversionEventUpdateSchema>;
export type TrackingHealth = z.infer<typeof trackingHealthSchema>;
export type AttributionModel = z.infer<typeof attributionModelSchema>;
export type Attribution = z.infer<typeof attributionSchema>;
export type LibraryListQuery = z.infer<typeof libraryListQuerySchema>;
