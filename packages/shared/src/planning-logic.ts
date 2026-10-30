import type { AdPlatform, Campaign, CampaignMetricDay } from "./campaign";
import type { Money } from "./common";
import type { BudgetPlan, Planning } from "./planning";

export type ChannelHistory = { spend: number; leads: number; revenue: number };

const DAY_MS = 86_400_000;

/** Spend, leads and revenue per platform over the `days` days up to the newest metric day. */
export function channelHistory(
  campaigns: Campaign[],
  metricDays: Record<string, CampaignMetricDay[]>,
  currency: string,
  days = 30,
): Partial<Record<AdPlatform, ChannelHistory>> {
  const rows = campaigns.filter((c) => c.deletedAt === null).flatMap((c) => (metricDays[c.id] ?? []).map((d) => ({ platform: c.platform, d })));
  if (rows.length === 0) return {};
  const end = Math.max(...rows.map((r) => Date.parse(`${r.d.date}T00:00:00Z`)));
  const history: Partial<Record<AdPlatform, ChannelHistory>> = {};
  for (const { platform, d } of rows) {
    if (Date.parse(`${d.date}T00:00:00Z`) <= end - days * DAY_MS) continue;
    const h = (history[platform] ??= { spend: 0, leads: 0, revenue: 0 });
    if (d.spend.currency === currency) h.spend += d.spend.amount;
    if (d.revenue.currency === currency) h.revenue += d.revenue.amount;
    h.leads += d.leads;
  }
  return history;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /planning. Forecasts use each channel's own recent results: leads = planned ÷ its CPL,
 * revenue = planned × its ROAS. A channel without history forecasts nothing (null), and
 * its target, if it is a lead count, still counts towards the target leads.
 */
export function buildPlanning(
  plan: BudgetPlan,
  limit: Money,
  history: Partial<Record<AdPlatform, ChannelHistory>>,
  previousTargetLeads: number | null,
): Planning {
  const currency = limit.currency;
  const channels = plan.channels.filter((c) => c.planned.currency === currency);
  const allocated = channels.reduce((sum, c) => sum + c.planned.amount, 0);

  const rows = channels.map((c) => {
    const h = history[c.platform];
    const cpl = h && h.leads > 0 ? h.spend / h.leads : null;
    const roas = h && h.spend > 0 ? h.revenue / h.spend : null;
    return {
      platform: c.platform,
      share: allocated === 0 ? 0 : c.planned.amount / allocated,
      forecastLeads: cpl ? Math.round(c.planned.amount / cpl) : null,
      forecastRevenue: roas !== null ? { amount: round(c.planned.amount * roas), currency } : null,
    };
  });

  // Channels and their forecast rows side by side, without index lookups.
  const pairs = channels.map((channel, i) => ({ channel, row: rows[i]! }));
  const targetLeads = pairs.reduce((sum, { channel: c, row }) => {
    if (c.target.metric === "leads") return sum + c.target.value;
    if (c.target.metric === "cpl" && c.target.value > 0) return sum + Math.round(c.planned.amount / c.target.value);
    return sum + (row.forecastLeads ?? 0);
  }, 0);
  const forecastRevenue = rows.reduce((sum, r) => sum + (r.forecastRevenue?.amount ?? 0), 0);
  const forecastSpend = pairs.filter(({ row }) => row.forecastRevenue !== null).reduce((sum, { channel }) => sum + channel.planned.amount, 0);

  return {
    plan,
    limit,
    allocated: { amount: round(allocated), currency },
    allocatedShare: limit.amount > 0 ? allocated / limit.amount : 0,
    channels: rows,
    targetLeads,
    previousTargetLeads,
    forecastRevenue: { amount: round(forecastRevenue), currency },
    forecastRoas: forecastSpend > 0 ? forecastRevenue / forecastSpend : null,
  };
}
