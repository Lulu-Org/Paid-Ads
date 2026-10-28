import { z } from "zod";
import { idSchema } from "./common";

// Paid Ads roles (design: "Team & Permissions"), on top of the platform's sign-in roles (owner, admin,
// member). They say what a person may do with campaigns and budgets. docs/api.md, "Team".

export const adsRoles = ["owner", "editor", "reviewer", "analyst"] as const;
export const adsRoleSchema = z.enum(adsRoles);

// Which channels a teammate works with.
export const channelScopeSchema = z.enum(["all", "google_ads", "meta_ads", "reports_only"]);

export const teamMemberSchema = z.object({
  userId: idSchema,
  name: z.string().min(1),
  email: z.email(),
  // e.g. "Performance marketer"; free text.
  title: z.string().max(100).nullable(),
  adsRole: adsRoleSchema,
  channelScope: channelScopeSchema,
  canApproveCreatives: z.boolean(),
  // True until the invited person signs in for the first time.
  invited: z.boolean(),
});

export const teamInviteSchema = z.object({
  email: z.email(),
  adsRole: adsRoleSchema.exclude(["owner"]),
  channelScope: channelScopeSchema,
  canApproveCreatives: z.boolean(),
});

export const teamMemberUpdateSchema = teamInviteSchema.omit({ email: true }).partial();

// The design's role matrix. "request" = may ask, someone with "yes" approves.
export type Capability = "yes" | "request" | "no";
export const roleMatrix: Record<AdsRole, { view: Capability; edit: Capability; budget: Capability; launch: Capability }> = {
  owner: { view: "yes", edit: "yes", budget: "yes", launch: "yes" },
  editor: { view: "yes", edit: "yes", budget: "request", launch: "request" },
  reviewer: { view: "yes", edit: "no", budget: "yes", launch: "no" },
  analyst: { view: "yes", edit: "no", budget: "no", launch: "no" },
};

export type AdsRole = z.infer<typeof adsRoleSchema>;
export type ChannelScope = z.infer<typeof channelScopeSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
export type TeamMemberUpdateInput = z.infer<typeof teamMemberUpdateSchema>;
