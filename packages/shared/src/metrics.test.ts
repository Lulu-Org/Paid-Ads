import { describe, expect, it } from "vitest";
import type { CampaignMetricDay } from "./campaign";
import { campaignTotals, change, ctr, overviewQuerySchema, progress } from "./metrics";

const day = (date: string, spend: number, leads: number, extra: Partial<CampaignMetricDay> = {}): CampaignMetricDay => ({
  date,
  impressions: 1000,
  clicks: 50,
  conversions: leads,
  leads,
  spend: { amount: spend, currency: "EUR" },
  revenue: { amount: spend * 4, currency: "EUR" },
  ...extra,
});

describe("campaignTotals", () => {
  it("sums days in cents and computes CTR, CPL, ROAS and progress", () => {
    const totals = campaignTotals([day("2026-10-01", 0.1, 1), day("2026-10-02", 0.2, 2)], { amount: 3, currency: "EUR" });
    expect(totals.spend).toEqual({ amount: 0.3, currency: "EUR" });
    expect(totals.revenue).toEqual({ amount: 1.2, currency: "EUR" });
    expect(totals).toMatchObject({ impressions: 2000, clicks: 100, leads: 3, conversions: 3 });
    expect(totals.ctr).toBe(0.05);
    expect(totals.cpl).toEqual({ amount: 0.1, currency: "EUR" });
    expect(totals.roas).toBe(4);
    expect(totals.progress).toBeCloseTo(0.1);
  });

  it("matches the design's Spring launch campaign: €4,280 spend, 184 leads, €23.26 CPL, 71% of €6,000", () => {
    const totals = campaignTotals([day("2026-06-01", 4280, 184, { revenue: { amount: 20480, currency: "EUR" } })], {
      amount: 6000,
      currency: "EUR",
    });
    expect(totals.cpl).toEqual({ amount: 23.26, currency: "EUR" });
    expect(Math.round(totals.progress * 100)).toBe(71);
    expect(totals.roas).toBeCloseTo(4.79, 2);
  });

  it("returns nulls instead of dividing by zero, and leaves out other currencies", () => {
    const totals = campaignTotals(
      [day("2026-10-01", 0, 0, { impressions: 0, clicks: 0 }), day("2026-10-02", 50, 5, { spend: { amount: 50, currency: "USD" } })],
      { amount: 2500, currency: "EUR" },
    );
    expect(totals).toMatchObject({ ctr: null, cpl: null, roas: null, progress: 0, leads: 0 });
  });
});

describe("overviewQuerySchema", () => {
  it("defaults to 30 days and coerces the query string", () => {
    expect(overviewQuerySchema.parse({})).toEqual({ rangeDays: 30 });
    expect(overviewQuerySchema.parse({ rangeDays: "90" })).toEqual({ rangeDays: 90 });
  });

  it("rejects ranges outside 1 to 366 days", () => {
    expect(overviewQuerySchema.safeParse({ rangeDays: "0" }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ rangeDays: "367" }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ rangeDays: "1" }).success).toBe(true);
    expect(overviewQuerySchema.safeParse({ rangeDays: "366" }).success).toBe(true);
  });
});

describe("rates", () => {
  it("caps progress between 0 and 1", () => {
    expect(progress(7000, 6000)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });

  it("computes change vs. the previous period", () => {
    expect(change(112.4, 100)).toBeCloseTo(0.124);
    expect(change(5, 0)).toBeNull();
    expect(ctr(18400, 412800)).toBeCloseTo(0.0446, 4);
  });
});
