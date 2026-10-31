import { describe, expect, it } from "vitest";
import type { Campaign, CampaignMetricDay } from "./campaign";
import { buildPlanning, channelHistory } from "./planning-logic";
import { planningSchema, type BudgetPlan } from "./planning";
import { buildReport, reportRunSchema } from "./reporting";

const base = { workspaceId: "w", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null };
const eur = (amount: number) => ({ amount, currency: "EUR" });
const campaign = (id: string, platform: Campaign["platform"], extra: Partial<Campaign> = {}): Campaign => ({
  ...base, id, adAccountId: null, platform, externalId: null, name: id, status: "live", objective: "Leads",
  audienceSummary: null, startAt: null, endAt: null, budget: eur(1000), rationale: null, nextStep: null, ownerId: "u", ...extra,
});
const day = (date: string, spend: number, revenue: number, leads: number, clicks = 100): CampaignMetricDay => ({
  date, impressions: 1000, clicks, conversions: leads, leads, spend: eur(spend), revenue: eur(revenue),
});

const campaigns = [campaign("g", "google_ads"), campaign("m", "meta_ads"), campaign("gone", "meta_ads", { deletedAt: "2026-06-01T00:00:00.000Z" })];
const days = {
  // before: 06-01..06-02, now: 06-03..06-04
  g: [day("2026-06-01", 100, 200, 2), day("2026-06-02", 100, 200, 2), day("2026-06-03", 200, 1000, 10), day("2026-06-04", 200, 1000, 10)],
  m: [day("2026-06-04", 100, 300, 10)],
  gone: [day("2026-06-04", 9999, 0, 0)],
};

describe("buildReport", () => {
  const run = buildReport({ campaigns, days, currency: "EUR" }, { from: "2026-06-03", to: "2026-06-04", platforms: [] });

  it("matches the schema and sums the range, ignoring deleted campaigns", () => {
    expect(() => reportRunSchema.parse(run)).not.toThrow();
    expect(run.revenue.value).toBe(2300);
    expect(run.leads.value).toBe(30);
    expect(run.costPerLead.value).toBe(16.67);
  });

  it("compares with the period just before, conversion rate in points", () => {
    expect(run.revenue.change).toBeCloseTo(4.75, 2);
    expect(run.conversionRate.value).toBeCloseTo(30 / 300, 5);
    expect(run.conversionRate.change).toBeCloseTo(0.1 - 0.02, 5);
  });

  it("splits by channel and filters platforms", () => {
    const by = Object.fromEntries(run.channels.map((c) => [c.platform, c]));
    expect(by.google_ads).toMatchObject({ campaigns: 1, spend: eur(400), leads: 20, roas: 5 });
    expect(by.linkedin_ads).toMatchObject({ campaigns: 0, roas: null });
    const meta = buildReport({ campaigns, days, currency: "EUR" }, { from: "2026-06-03", to: "2026-06-04", platforms: ["meta_ads"] });
    expect(meta.channels).toHaveLength(1);
    expect(meta.leads.value).toBe(10);
    expect(meta.revenue.change).toBeNull();
  });
});

describe("buildPlanning", () => {
  it("adds money in whole cents, without floating point noise", () => {
    const tenths = (id: string, amount: number) => ({ platform: id as "google_ads", planned: eur(amount), target: { metric: "leads" as const, value: 1 } });
    const plan: BudgetPlan = {
      ...base, id: "p", name: "Cents", month: "2026-06", status: "draft",
      channels: [tenths("google_ads", 0.1), tenths("meta_ads", 0.2)],
      steps: [], rationale: { goal: "", constraint: "", signal: "" }, nextReviewAt: null, nextReviewNote: null,
    };
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(buildPlanning(plan, eur(16000), {}, null).allocated).toEqual(eur(0.3));
    const history = channelHistory([campaign("c", "google_ads")], { c: [day("2026-06-01", 0.1, 0.1, 1), day("2026-06-02", 0.2, 0.2, 1)] }, "EUR");
    expect(history.google_ads).toEqual({ spend: 0.3, leads: 2, revenue: 0.3 });
  });

  const plan: BudgetPlan = {
    ...base, id: "p", name: "June", month: "2026-06", status: "draft",
    channels: [
      { platform: "google_ads", planned: eur(600), target: { metric: "roas", value: 4.5 } },
      { platform: "meta_ads", planned: eur(300), target: { metric: "cpl", value: 15 } },
      { platform: "linkedin_ads", planned: eur(100), target: { metric: "leads", value: 8 } },
    ],
    steps: [], rationale: { goal: "", constraint: "", signal: "" }, nextReviewAt: null, nextReviewNote: null,
  };
  const history = channelHistory(campaigns, days, "EUR", 30);
  const result = buildPlanning(plan, eur(2000), history, 40);

  it("uses the channels' own history, ignoring deleted campaigns", () => {
    expect(history.google_ads).toEqual({ spend: 600, leads: 24, revenue: 2400 });
    expect(history.meta_ads).toEqual({ spend: 100, leads: 10, revenue: 300 });
  });

  it("allocates, forecasts and sums the targets", () => {
    expect(() => planningSchema.parse(result)).not.toThrow();
    expect(result.allocated).toEqual(eur(1000));
    expect(result.allocatedShare).toBe(0.5);
    const by = Object.fromEntries(result.channels.map((c) => [c.platform, c]));
    expect(by.google_ads).toMatchObject({ share: 0.6, forecastLeads: 24, forecastRevenue: eur(2400) });
    expect(by.linkedin_ads).toMatchObject({ forecastLeads: null, forecastRevenue: null });
    // google: no lead target → forecast 24; meta: 300 / 15 = 20; linkedin: 8
    expect(result.targetLeads).toBe(52);
    expect(result.forecastRevenue).toEqual(eur(3300));
    expect(result.forecastRoas).toBeCloseTo(3300 / 900, 5);
  });
});
