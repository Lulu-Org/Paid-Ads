import type { BudgetPlan, Report, VariantRole } from "@lulu/shared";
import { DEMO_WORKSPACE_ID } from "./fixtures";

// Sample data for Planning, Audiences, Creatives and Reports (F2), from the MagicPath design.

const base = {
  workspaceId: DEMO_WORKSPACE_ID,
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T09:00:00.000Z",
  deletedAt: null,
};
const eur = (amount: number) => ({ amount, currency: "EUR" });

// What the audience cards show beyond the Audience record (description, match rate, exclusions)
// and which campaigns use each audience (CampaignAudience).
export const demoAudienceExtras: Record<string, { description: string | null; matchRate: number | null; exclusions: string[]; campaignIds: string[] }> = {
  audience_website_30d: {
    description: "Visitors from Lulu Online Presence",
    matchRate: 0.82,
    exclusions: ["Employees"],
    campaignIds: ["campaign_spring_berlin", "campaign_studio_awareness"],
  },
  audience_crm_qualified: {
    description: "Contacts with an active sales stage",
    matchRate: 0.76,
    exclusions: ["Existing customers"],
    campaignIds: ["campaign_spring_berlin", "campaign_local_calls", "campaign_b2b_q4"],
  },
  audience_lookalike_studio: {
    description: "Modeled from 2,140 converted leads",
    matchRate: null,
    exclusions: [],
    campaignIds: ["campaign_studio_awareness"],
  },
};

// Creative test results per CampaignCreative (design: Creative testing, CPL 18.40 / 14.52 / 20.11).
export const demoVariantResults: { campaignId: string; variant: string; creativeId: string; role: VariantRole; spend: number; leads: number }[] = [
  { campaignId: "campaign_studio_awareness", variant: "A", creativeId: "creative_studio_walkthrough", role: "control", spend: 3385.6, leads: 184 },
  { campaignId: "campaign_studio_awareness", variant: "B", creativeId: "creative_before_after", role: "winner", spend: 3354.12, leads: 231 },
  { campaignId: "campaign_studio_awareness", variant: "C", creativeId: "creative_studio_form", role: "learning", spend: 1649.02, leads: 82 },
];

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export function demoBudgetPlan(): BudgetPlan {
  return {
    ...base,
    id: "plan_2026_06",
    name: "June plan",
    month: "2026-06",
    status: "pending_approval",
    channels: [
      { platform: "google_ads", planned: eur(6000), target: { metric: "roas", value: 4.5 } },
      { platform: "google_lsa", planned: eur(3000), target: { metric: "cpl", value: 22 } },
      { platform: "meta_ads", planned: eur(4500), target: { metric: "cpl", value: 14 } },
      { platform: "linkedin_ads", planned: eur(2500), target: { metric: "leads", value: 80 } },
    ],
    steps: [
      { label: "Set targets", detail: "Goals confirmed by Jamie", status: "done" },
      { label: "Allocate budgets", detail: "Four channels covered", status: "done" },
      { label: "Approve scenario", detail: "Waiting for finance owner", status: "current" },
      { label: "Launch and monitor", detail: "Starts after approval", status: "upcoming" },
    ],
    rationale: {
      goal: "Balance lead volume with qualified pipeline, not clicks alone.",
      constraint: "Keep monthly spend below €16,000 and require Finance approval above €2,500.",
      signal: "Meta currently has the strongest qualified-lead rate and can absorb a 12% shift.",
    },
    nextReviewAt: inDays(3),
    nextReviewNote: "Meta budget shift",
  };
}

// Target leads of the May plan, so June shows its change.
export const demoPreviousTargetLeads = 674;

export const demoReports: Report[] = [
  {
    ...base,
    id: "report_weekly_channels",
    name: "Weekly channel summary",
    view: { platforms: [], rangeDays: 7, compare: "previous_period" },
    schedule: "0 8 * * 1",
    recipients: ["jamie@lulu.demo"],
  },
  {
    ...base,
    id: "report_meta_monthly",
    name: "Meta monthly results",
    view: { platforms: ["meta_ads"], rangeDays: 30, compare: "previous_period" },
    schedule: null,
    recipients: [],
  },
];
