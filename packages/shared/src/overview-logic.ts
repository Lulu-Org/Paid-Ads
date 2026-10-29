import { adPlatforms, type AdAccount, type Campaign, type CampaignMetricDay } from "./campaign";
import { change, type Kpi, type Overview } from "./metrics";

const DAY_MS = 86_400_000;

export type OverviewInput = {
  campaigns: Campaign[];
  // Metric days by campaign id.
  days: Record<string, CampaignMetricDay[]>;
  accounts: AdAccount[];
  currency: string;
  rangeDays: number;
  today: Date;
};

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type DayTotals = { spend: number; revenue: number; leads: number };

/**
 * GET /overview. The range ends on the newest day with metrics, so a workspace whose last sync was
 * a while ago still sees its numbers. Money counts only rows in `currency`.
 */
export function buildOverview(input: OverviewInput): Overview {
  const live = input.campaigns.filter((c) => c.deletedAt === null);
  const allDays = live.flatMap((c) => input.days[c.id] ?? []);
  const end = allDays.length ? Math.max(...allDays.map((d) => Date.parse(`${d.date}T00:00:00Z`))) : Date.parse(`${isoDay(input.today.getTime())}T00:00:00Z`);

  const byDate = new Map<string, DayTotals>();
  for (const d of allDays) {
    const row = byDate.get(d.date) ?? { spend: 0, revenue: 0, leads: 0 };
    if (d.spend.currency === input.currency) row.spend += d.spend.amount;
    if (d.revenue.currency === input.currency) row.revenue += d.revenue.amount;
    row.leads += d.leads;
    byDate.set(d.date, row);
  }

  // Oldest first. `offset` 0 is the current range, 1 the one before it.
  const range = (offset: number) =>
    Array.from({ length: input.rangeDays }, (_, i) => {
      const date = isoDay(end - (offset * input.rangeDays + input.rangeDays - 1 - i) * DAY_MS);
      return byDate.get(date) ?? { spend: 0, revenue: 0, leads: 0 };
    });
  const current = range(0);
  const previous = range(1);

  const sum = (rows: DayTotals[], key: keyof DayTotals) => rows.reduce((total, r) => total + r[key], 0);
  const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);
  const round = (n: number) => Math.round(n * 100) / 100;

  const kpi = (value: (rows: DayTotals[]) => number, daily: (r: DayTotals) => number): Kpi => {
    const now = value(current);
    const before = value(previous);
    return { value: round(now), change: before === 0 && now === 0 ? null : change(now, before), trend: current.map((r) => round(daily(r))) };
  };

  const inRange = (d: CampaignMetricDay) => {
    const t = Date.parse(`${d.date}T00:00:00Z`);
    return t > end - input.rangeDays * DAY_MS && t <= end;
  };

  return {
    rangeDays: input.rangeDays,
    endDate: isoDay(end),
    currency: input.currency,
    spend: kpi((rows) => sum(rows, "spend"), (r) => r.spend),
    revenue: kpi((rows) => sum(rows, "revenue"), (r) => r.revenue),
    leads: kpi((rows) => sum(rows, "leads"), (r) => r.leads),
    cpl: kpi((rows) => ratio(sum(rows, "spend"), sum(rows, "leads")), (r) => ratio(r.spend, r.leads)),
    roas: kpi((rows) => ratio(sum(rows, "revenue"), sum(rows, "spend")), (r) => ratio(r.revenue, r.spend)),
    platforms: adPlatforms.map((platform) => {
      const campaigns = live.filter((c) => c.platform === platform);
      const days = campaigns.flatMap((c) => input.days[c.id] ?? []).filter(inRange);
      return {
        platform,
        connected: input.accounts.some((a) => a.platform === platform && a.deletedAt === null && a.status !== "disconnected"),
        campaigns: campaigns.length,
        spend: { amount: round(days.filter((d) => d.spend.currency === input.currency).reduce((t, d) => t + d.spend.amount, 0)), currency: input.currency },
        leads: days.reduce((t, d) => t + d.leads, 0),
      };
    }),
  };
}
