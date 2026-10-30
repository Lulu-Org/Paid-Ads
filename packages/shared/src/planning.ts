import { z } from "zod";
import { adPlatformSchema, planStepStatusSchema } from "./campaign";
import { baseRecordSchema, moneySchema, timestampSchema } from "./common";

// Budget planning (design: Planning). One plan per workspace and month; scenarios are drafts of it.

export const planTargetMetricSchema = z.enum(["roas", "cpl", "leads"]);
export const planStatusSchema = z.enum(["draft", "pending_approval", "approved"]);

export const planChannelSchema = z.object({
  platform: adPlatformSchema,
  planned: moneySchema,
  // What the channel is held to: a ROAS (4.5), a CPL (money amount in `planned.currency`) or a lead count.
  target: z.object({ metric: planTargetMetricSchema, value: z.number().min(0) }),
});

export const budgetPlanSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1).max(200),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  status: planStatusSchema,
  channels: z.array(planChannelSchema),
  steps: z.array(z.object({ label: z.string().max(200), detail: z.string().max(300), status: planStepStatusSchema })),
  // The design's "Planning logic": why the plan looks this way. Written by people.
  rationale: z.object({ goal: z.string().max(500), constraint: z.string().max(500), signal: z.string().max(500) }),
  nextReviewAt: timestampSchema.nullable(),
  nextReviewNote: z.string().max(200).nullable(),
});

// GET /planning: the current plan with what is computed from it (buildPlanning).
export const planningSchema = z.object({
  plan: budgetPlanSchema,
  // The monthly spend limit (Billing & Controls) the plan is allocated against.
  limit: moneySchema,
  allocated: moneySchema,
  allocatedShare: z.number().min(0),
  channels: z.array(
    z.object({
      platform: adPlatformSchema,
      // Share of the allocated budget, 0 to 1.
      share: z.number().min(0).max(1),
      // From the channel's own ROAS and CPL over the last 30 days of metrics; null without history.
      forecastLeads: z.number().min(0).nullable(),
      forecastRevenue: moneySchema.nullable(),
    }),
  ),
  targetLeads: z.number().min(0),
  // Target leads of the previous month's plan, for "+18% vs. last plan"; null without one.
  previousTargetLeads: z.number().min(0).nullable(),
  forecastRevenue: moneySchema,
  forecastRoas: z.number().min(0).nullable(),
});

// POST /planning/scenarios: a draft with other channel amounts. Same month and targets as the plan.
export const planScenarioCreateSchema = z.object({
  name: budgetPlanSchema.shape.name,
  channels: z.array(z.object({ platform: adPlatformSchema, planned: moneySchema })).min(1),
});

export type PlanTargetMetric = z.infer<typeof planTargetMetricSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanChannel = z.infer<typeof planChannelSchema>;
export type BudgetPlan = z.infer<typeof budgetPlanSchema>;
export type Planning = z.infer<typeof planningSchema>;
export type PlanScenarioCreateInput = z.infer<typeof planScenarioCreateSchema>;
