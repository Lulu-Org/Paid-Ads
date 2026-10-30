import { z } from "zod";
import { adPlatformSchema, adPlatforms, type AdPlatform, type Campaign, type CampaignMetricDay } from "./campaign";
import { moneySchema } from "./common";
import { change } from "./metrics";

// GET /reports/run (ad hoc) and GET /reports/:id/run (a saved report's view).

export const reportRunQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  // Empty = every platform.
  platforms: z.array(adPlatformSchema).default([]),
});

const reportKpiSchema = z.object({ value: z.number(), change: z.number().nullable() });

export const reportRunSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  // Changes compare with the period of the same length just before `from`.
  // conversionRate's change is in percentage points (0.006 = +0.6pp), the others are fractions.
  revenue: reportKpiSchema,
  leads: reportKpiSchema,
  conversionRate: reportKpiSchema,
  costPerLead: reportKpiSchema,
  channels: z.array(
    z.object({
      platform: adPlatformSchema,
      campaigns: z.number().int().min(0),
      spend: moneySchema,
      leads: z.number().int().min(0),
      conversions: z.number().int().min(0),
      revenue: moneySchema,
      roas: z.number().min(0).nullable(),
    }),
  ),
});

export type ReportRunQuery = z.infer<typeof reportRunQuerySchema>;
export type ReportRun = z.infer<typeof reportRunSchema>;

const DAY_MS = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const round = (n: number) => Math.round(n * 100) / 100;

type Totals = { spend: number; revenue: number; leads: number; conversions: number; clicks: number };

export function buildReport(
  input: { campaigns: Campaign[]; days: Record<string, CampaignMetricDay[]>; currency: string },
  query: ReportRunQuery,
): ReportRun {
  const platforms: readonly AdPlatform[] = query.platforms.length ? query.platforms : adPlatforms;
  const campaigns = input.campaigns.filter((c) => c.deletedAt === null && platforms.includes(c.platform));
  const from = day(query.from);
  const to = day(query.to);
  const length = to - from + DAY_MS;

  const sum = (rows: CampaignMetricDay[]): Totals =>
    rows.reduce<Totals>(
      (t, d) => ({
        spend: t.spend + (d.spend.currency === input.currency ? d.spend.amount : 0),
        revenue: t.revenue + (d.revenue.currency === input.currency ? d.revenue.amount : 0),
        leads: t.leads + d.leads,
        conversions: t.conversions + d.conversions,
        clicks: t.clicks + d.clicks,
      }),
      { spend: 0, revenue: 0, leads: 0, conversions: 0, clicks: 0 },
    );
  const between = (c: Campaign, start: number, end: number) =>
    (input.days[c.id] ?? []).filter((d) => day(d.date) >= start && day(d.date) <= end);

  const now = sum(campaigns.flatMap((c) => between(c, from, to)));
  const before = sum(campaigns.flatMap((c) => between(c, from - length, from - DAY_MS)));
  const rate = (t: Totals) => (t.clicks ? t.conversions / t.clicks : 0);
  const cpl = (t: Totals) => (t.leads ? t.spend / t.leads : 0);
  const kpi = (a: number, b: number, hasBefore: boolean) => ({ value: round(a), change: hasBefore ? change(a, b) : null });
  const hasBefore = before.spend + before.leads + before.clicks > 0;

  return {
    from: query.from,
    to: query.to,
    currency: input.currency,
    revenue: kpi(now.revenue, before.revenue, hasBefore),
    leads: kpi(now.leads, before.leads, hasBefore),
    conversionRate: { value: rate(now), change: hasBefore ? rate(now) - rate(before) : null },
    costPerLead: kpi(cpl(now), cpl(before), hasBefore && before.leads > 0),
    channels: platforms.map((platform) => {
      const own = campaigns.filter((c) => c.platform === platform);
      const t = sum(own.flatMap((c) => between(c, from, to)));
      return {
        platform,
        campaigns: own.length,
        spend: { amount: round(t.spend), currency: input.currency },
        leads: t.leads,
        conversions: t.conversions,
        revenue: { amount: round(t.revenue), currency: input.currency },
        roas: t.spend > 0 ? t.revenue / t.spend : null,
      };
    }),
  };
}
