import { describe, expect, it } from "vitest";
import {
  adAccountSchema,
  audienceSchema,
  automationRuleSchema,
  campaignMetricDaySchema,
  campaignPlanStepSchema,
  campaignSchema,
  campaignTotals,
  conversionEventSchema,
  creativeSchema,
  syncRunSchema,
  userSchema,
} from "@lulu/shared";
import {
  demoAdAccounts,
  demoAudiences,
  demoAutomationRules,
  demoCampaignCreatives,
  demoCampaigns,
  demoConversionEvents,
  demoCreatives,
  demoMetricDays,
  demoPlans,
  demoSyncRuns,
  demoUsers,
} from "./fixtures";

const totalsOf = (id: string) => {
  const campaign = demoCampaigns.find((c) => c.id === id)!;
  return campaignTotals(demoMetricDays[id]!, campaign.budget, campaign.budgetPeriod);
};

describe("sample data", () => {
  it("fits the shared schemas", () => {
    for (const user of demoUsers) userSchema.parse(user);
    for (const account of demoAdAccounts) adAccountSchema.parse(account);
    for (const campaign of demoCampaigns) campaignSchema.parse(campaign);
    for (const days of Object.values(demoMetricDays)) for (const d of days) campaignMetricDaySchema.parse(d);
    for (const plan of Object.values(demoPlans)) for (const step of plan) campaignPlanStepSchema.parse(step);
    for (const creative of demoCreatives) creativeSchema.parse(creative);
    for (const audience of demoAudiences) audienceSchema.parse(audience);
    for (const event of demoConversionEvents) conversionEventSchema.parse(event);
    for (const rule of demoAutomationRules) automationRuleSchema.parse(rule);
    for (const run of demoSyncRuns) syncRunSchema.parse(run);
  });

  it("adds up to the design's numbers for every campaign", () => {
    expect(totalsOf("campaign_spring_berlin")).toMatchObject({
      spend: { amount: 4280 },
      revenue: { amount: 20480 },
      leads: 184,
      impressions: 412800,
      clicks: 18400,
      cpl: { amount: 23.26 },
    });
    expect(Math.round(totalsOf("campaign_spring_berlin").progress * 100)).toBe(71);
    expect(totalsOf("campaign_local_calls")).toMatchObject({ spend: { amount: 1940 }, leads: 96, calls: 96, cpl: { amount: 20.21 } });
    expect(Math.round(totalsOf("campaign_local_calls").progress * 100)).toBe(65);
    expect(totalsOf("campaign_studio_awareness")).toMatchObject({ spend: { amount: 2660 }, leads: 231, cpl: { amount: 11.52 } });
    expect(totalsOf("campaign_b2b_q4")).toMatchObject({ spend: { amount: 0 }, leads: 0, calls: 0, cpl: null, progress: 0 });
  });

  it("links every campaign to existing creatives, plans and accounts", () => {
    const creativeIds = new Set(demoCreatives.map((c) => c.id));
    for (const campaign of demoCampaigns) {
      expect(demoPlans[campaign.id]?.length).toBeGreaterThan(0);
      for (const id of demoCampaignCreatives[campaign.id] ?? []) expect(creativeIds.has(id)).toBe(true);
      if (campaign.adAccountId) expect(demoAdAccounts.some((a) => a.id === campaign.adAccountId)).toBe(true);
    }
  });
});
