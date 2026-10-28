import type { AdAccount, Campaign, CampaignChecklist, ChecklistItemKey } from "./campaign";
import type { ApprovalPolicy, ApprovalRequest, CampaignDefaults } from "./controls";
import type { Audience, Creative } from "./library";

// The launch checklist (design: "Launch Checklist"): nothing launches until data, assets, permissions
// and approvals are ready. The API (GET /campaigns/:id/checklist, POST /campaigns/:id/launch) and the
// mock both use this, so the rules are the same everywhere.

export interface ChecklistInput {
  campaign: Campaign;
  account: AdAccount | null;
  creatives: Creative[];
  audiences: Audience[];
  trackingHealthy: boolean;
  defaults: CampaignDefaults;
  policy: ApprovalPolicy;
  approvals: ApprovalRequest[];
}

/** Whether launching this campaign needs an approval under the policy. */
export function needsLaunchApproval(campaign: Campaign, policy: ApprovalPolicy): boolean {
  if (policy.scope === "none" || policy.scope === "creative_only") return false;
  if (campaign.budget.currency !== policy.threshold.currency) return true;
  return campaign.budget.amount > policy.threshold.amount;
}

export function launchChecklist(input: ChecklistInput): CampaignChecklist {
  const { campaign, account, creatives, audiences, defaults, policy, approvals } = input;
  const approved = approvals.some(
    (a) => a.campaignId === campaign.id && a.kind === "launch" && a.status === "approved",
  );
  const checks: Record<ChecklistItemKey, boolean> = {
    account_connected: account?.status === "connected",
    budget_set: campaign.budget.amount > 0,
    schedule_set: campaign.startAt !== null,
    audience_set: Boolean(campaign.audienceSummary),
    creative_approved: creatives.length > 0 && creatives.every((c) => c.approvalStatus === "approved"),
    tracking_ready: input.trackingHealthy,
    // With "consent required" on, the campaign's platform needs an audience with a consent basis.
    consent_checked:
      !defaults.consentRequired || audiences.some((a) => a.platforms.includes(campaign.platform) && a.consentBasis.trim() !== ""),
    landing_page_ready: campaign.platform === "google_lsa" || creatives.some((c) => c.type !== "profile"),
    approval_granted: !needsLaunchApproval(campaign, policy) || approved,
    owner_assigned: campaign.ownerId !== "",
  };
  const items = (Object.keys(checks) as ChecklistItemKey[]).map((key) => ({ key, passed: checks[key] }));
  return { items, passed: items.filter((i) => i.passed).length, total: items.length };
}
