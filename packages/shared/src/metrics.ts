import { z } from "zod";
import { adPlatformSchema, type CampaignMetricDay, type CampaignTotals } from "./campaign";
import { moneySchema, type Money } from "./common";

// The numbers every view shows, computed the same way in the API and the mock (AGENTS.md rule 3).
// Money is summed in whole cents so totals do not pick up floating point noise.

const cents = (amount: number) => Math.round(amount * 100);
const fromCents = (value: number) => value / 100;

/** Totals for one campaign from its metric days. Days in another currency are left out. */
export function campaignTotals(days: CampaignMetricDay[], budget: Money): CampaignTotals {
  const own = days.filter((d) => d.spend.currency === budget.currency);
  const sum = (pick: (d: CampaignMetricDay) => number) => own.reduce((total, d) => total + pick(d), 0);
  const spendCents = sum((d) => cents(d.spend.amount));
  const revenueCents = sum((d) => cents(d.revenue.amount));
  const impressions = sum((d) => d.impressions);
  const clicks = sum((d) => d.clicks);
  const leads = sum((d) => d.leads);
  const currency = budget.currency;
  return {
    spend: { amount: fromCents(spendCents), currency },
    revenue: { amount: fromCents(revenueCents), currency },
    impressions,
    clicks,
    conversions: sum((d) => d.conversions),
    leads,
    calls: sum((d) => d.calls),
    ctr: ctr(clicks, impressions),
    cpl: leads > 0 ? { amount: Math.round(spendCents / leads) / 100, currency } : null,
    roas: spendCents > 0 ? revenueCents / spendCents : null,
    progress: progress(fromCents(spendCents), budget.amount),
  };
}

/** Click-through rate, 0 to 1; null without impressions. */
export function ctr(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null;
}

/** Share of the budget spent, capped at 1; 0 for no budget. */
export function progress(spent: number, budget: number): number {
  return budget > 0 ? Math.min(1, Math.max(0, spent / budget)) : 0;
}

/** Change from `previous` to `current` as a fraction (0.124 = +12.4%); null when there is no previous value. */
export function change(current: number, previous: number): number | null {
  return previous !== 0 ? (current - previous) / Math.abs(previous) : null;
}

// ---------- GET /overview ----------

export const overviewQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(1).max(366).default(30),
});

export const kpiSchema = z.object({
  value: z.number(),
  // Fraction vs. the previous period of the same length; null without data.
  change: z.number().nullable(),
  // Daily values for the sparkline, oldest first.
  trend: z.array(z.number()),
});

export const overviewSchema = z.object({
  rangeDays: z.number().int().min(1),
  // Last day of the range: the newest day with synced metrics (today when there is none yet).
  endDate: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  spend: kpiSchema,
  revenue: kpiSchema,
  leads: kpiSchema,
  cpl: kpiSchema,
  roas: kpiSchema,
  platforms: z.array(
    z.object({
      platform: adPlatformSchema,
      connected: z.boolean(),
      campaigns: z.number().int().min(0),
      spend: moneySchema,
      leads: z.number().int().min(0),
    }),
  ),
});

export type Kpi = z.infer<typeof kpiSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
