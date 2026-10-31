import { describe, expect, it } from "vitest";
import type { AdAccount, Campaign, CampaignMetricDay } from "./campaign";
import { overviewSchema } from "./metrics";
import { buildOverview } from "./overview-logic";

const base = { workspaceId: "w", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null };
const eur = (amount: number) => ({ amount, currency: "EUR" });
const campaign = (id: string, platform: Campaign["platform"], extra: Partial<Campaign> = {}): Campaign => ({
  ...base, id, adAccountId: null, platform, externalId: null, name: id, status: "live", objective: "Leads",
  audienceSummary: null, startAt: null, endAt: null, budget: eur(1000), budgetPeriod: "monthly", rationale: null, nextStep: null, ownerId: "u", ...extra,
});
const day = (date: string, spend: number, revenue: number, leads: number, currency = "EUR"): CampaignMetricDay => ({
  date, impressions: 100, clicks: 10, conversions: leads, leads, calls: 0, spend: { amount: spend, currency }, revenue: { amount: revenue, currency },
});
const account = (platform: AdAccount["platform"], status: AdAccount["status"]): AdAccount => ({
  ...base, id: `a_${platform}`, platform, externalId: "x", name: platform, currency: "EUR", status, scopes: [], lastSyncAt: null, lastError: null,
});

const input = {
  campaigns: [campaign("c1", "google_ads"), campaign("c2", "meta_ads"), campaign("gone", "meta_ads", { deletedAt: "2026-06-01T00:00:00.000Z" })],
  days: {
    // Previous 2-day range: 6-1, 6-2. Current: 6-3, 6-4.
    c1: [day("2026-06-01", 50, 100, 1), day("2026-06-02", 50, 100, 1), day("2026-06-03", 100, 400, 2), day("2026-06-04", 100, 400, 3)],
    c2: [day("2026-06-04", 20, 0, 0), day("2026-06-04", 999, 999, 0, "USD")],
    gone: [day("2026-06-09", 5000, 0, 0)],
  },
  accounts: [account("google_ads", "connected"), account("meta_ads", "needs_attention"), account("linkedin_ads", "disconnected")],
  currency: "EUR",
  rangeDays: 2,
  today: new Date("2026-10-29T10:00:00.000Z"),
};

describe("buildOverview", () => {
  const result = buildOverview(input);

  it("matches the schema and ends on the newest day with data, ignoring deleted campaigns", () => {
    expect(() => overviewSchema.parse(result)).not.toThrow();
    expect(result.endDate).toBe("2026-06-04");
  });

  it("sums the range, compares with the range before, and gives a daily trend", () => {
    expect(result.spend).toEqual({ value: 220, change: 1.2, trend: [100, 120] });
    expect(result.revenue.value).toBe(800);
    expect(result.leads).toEqual({ value: 5, change: 1.5, trend: [2, 3] });
    expect(result.cpl.value).toBe(44);
    expect(result.roas.value).toBeCloseTo(3.64, 2);
  });

  it("splits by platform with connection state", () => {
    const by = Object.fromEntries(result.platforms.map((p) => [p.platform, p]));
    expect(by.google_ads).toMatchObject({ connected: true, campaigns: 1, spend: eur(200), leads: 5 });
    expect(by.meta_ads).toMatchObject({ connected: true, campaigns: 1, spend: eur(20) });
    expect(by.linkedin_ads).toMatchObject({ connected: false, campaigns: 0 });
  });

  it("has no change without earlier data, and ends today without any data", () => {
    const empty = buildOverview({ ...input, days: {} });
    expect(empty.endDate).toBe("2026-10-29");
    expect(empty.spend).toEqual({ value: 0, change: null, trend: [0, 0] });
  });
});
