import { describe, expect, it } from "vitest";
import type { AdAccount, Campaign } from "./campaign";
import {
  launchChecklist,
  needsBudgetApproval,
  needsLaunchApproval,
  type ChecklistInput,
} from "./checklist";
import type { ApprovalPolicy, ApprovalRequest } from "./controls";
import type { Audience, Creative } from "./library";

const base = { workspaceId: "w", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", deletedAt: null };
const campaign: Campaign = {
  ...base,
  id: "c1",
  adAccountId: "a1",
  platform: "google_ads",
  externalId: null,
  name: "Test",
  status: "draft",
  objective: "Leads",
  audienceSummary: "Berlin",
  startAt: "2026-11-01T00:00:00.000Z",
  endAt: null,
  budget: { amount: 2000, currency: "EUR" },
  rationale: null,
  nextStep: null,
  ownerId: "u1",
};
const account = { ...base, id: "a1", platform: "google_ads", status: "connected" } as AdAccount;
const creative = (approvalStatus: Creative["approvalStatus"]) =>
  ({ ...base, id: `cr_${approvalStatus}`, name: "Ad", type: "search_ad", fileUrl: null, meta: {}, approvalStatus, approvedById: null }) as Creative;
const audience = { ...base, id: "au1", platforms: ["google_ads"], consentBasis: "CRM consent" } as Audience;
const policy: ApprovalPolicy = { scope: "budget_and_launch", threshold: { amount: 2500, currency: "EUR" }, approverRole: "reviewer" };

const input = (over: Partial<ChecklistInput> = {}): ChecklistInput => ({
  campaign,
  account,
  creatives: [creative("approved")],
  audiences: [audience],
  trackingHealthy: true,
  defaults: { consentRequired: true, autoTagLinks: true, policyValidation: true },
  policy,
  approvals: [],
  ...over,
});
const failing = (result: ReturnType<typeof launchChecklist>) => result.items.filter((i) => !i.passed).map((i) => i.key);

describe("launchChecklist", () => {
  it("passes every check for a ready campaign under the threshold", () => {
    const result = launchChecklist(input());
    expect(result).toMatchObject({ passed: 10, total: 10 });
  });

  it("blocks on an unapproved creative, a missing account and missing consent", () => {
    const result = launchChecklist(input({ account: null, creatives: [creative("approved"), creative("pending")], audiences: [] }));
    expect(failing(result)).toEqual(["account_connected", "creative_approved", "consent_checked"]);
    expect(result.passed).toBe(7);
  });

  it("needs an approved launch request above the threshold", () => {
    const big = { ...campaign, budget: { amount: 6000, currency: "EUR" } };
    expect(failing(launchChecklist(input({ campaign: big })))).toEqual(["approval_granted"]);
    const approved = { kind: "launch", campaignId: "c1", status: "approved" } as ApprovalRequest;
    expect(launchChecklist(input({ campaign: big, approvals: [approved] })).passed).toBe(10);
    const pending = { ...approved, status: "pending" } as ApprovalRequest;
    expect(failing(launchChecklist(input({ campaign: big, approvals: [pending] })))).toEqual(["approval_granted"]);
  });
});

describe("needsBudgetApproval", () => {
  const current = { amount: 2000, currency: "EUR" };

  it("never asks for approval under the no-approval scopes", () => {
    expect(
      needsBudgetApproval(current, { amount: 9000, currency: "EUR" }, { ...policy, scope: "none" }),
    ).toBe(false);
    expect(
      needsBudgetApproval(
        current,
        { amount: 9000, currency: "EUR" },
        { ...policy, scope: "creative_only" },
      ),
    ).toBe(false);
  });

  it("compares the absolute change, not the resulting total", () => {
    expect(needsBudgetApproval(current, { amount: 4500, currency: "EUR" }, policy)).toBe(false);
    expect(needsBudgetApproval(current, { amount: 4500.01, currency: "EUR" }, policy)).toBe(true);
    expect(needsBudgetApproval(current, { amount: 2000 - 2500, currency: "EUR" }, policy)).toBe(
      false,
    );
    expect(needsBudgetApproval(current, { amount: 2000 - 2500.01, currency: "EUR" }, policy)).toBe(
      true,
    );
  });

  it("does not ask for approval exactly at the threshold", () => {
    expect(needsBudgetApproval(current, { amount: 4500, currency: "EUR" }, policy)).toBe(false);
    expect(needsBudgetApproval(current, { amount: current.amount, currency: "EUR" }, policy)).toBe(
      false,
    );
  });

  it("asks for approval on a currency mismatch", () => {
    expect(needsBudgetApproval(current, { amount: 2001, currency: "USD" }, policy)).toBe(true);
    expect(needsBudgetApproval(current, { amount: 2001, currency: "EUR" }, { ...policy, threshold: { amount: 2500, currency: "USD" } })).toBe(true);
  });
});

describe("needsLaunchApproval", () => {
  it("follows the policy's scope, amount and currency", () => {
    const big = { ...campaign, budget: { amount: 6000, currency: "EUR" } };
    expect(needsLaunchApproval(big, policy)).toBe(true);
    expect(needsLaunchApproval(campaign, policy)).toBe(false);
    expect(needsLaunchApproval(big, { ...policy, scope: "none" })).toBe(false);
    expect(needsLaunchApproval({ ...campaign, budget: { amount: 100, currency: "USD" } }, policy)).toBe(true);
  });
});
