import { z } from "zod";
import { roleSchema, type Role } from "./user";

// Who may do what in Paid Ads (design: "Team & Permissions"). The owner can always do everything.

export const permissionResourceSchema = z.enum([
  "campaigns",
  "budgets",
  "audiences",
  "creatives",
  "tracking",
  "reports",
  "automations",
  "integrations",
  "billing",
  "settings",
]);
export const permissionActionSchema = z.enum(["view", "create", "edit", "delete", "approve"]);

export const rolePermissionsSchema = z.record(
  roleSchema.exclude(["owner"]),
  z.record(permissionResourceSchema, z.array(permissionActionSchema)),
);

export type PermissionResource = z.infer<typeof permissionResourceSchema>;
export type PermissionAction = z.infer<typeof permissionActionSchema>;
export type RolePermissions = z.infer<typeof rolePermissionsSchema>;

const all: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];

export const defaultPermissions: RolePermissions = {
  admin: {
    campaigns: all,
    budgets: all,
    audiences: all,
    creatives: all,
    tracking: all,
    reports: all,
    automations: all,
    integrations: all,
    billing: ["view", "edit", "approve"],
    settings: ["view", "edit"],
  },
  // Members run campaigns but cannot approve spend, connect accounts or change billing.
  member: {
    campaigns: ["view", "create", "edit"],
    budgets: ["view"],
    audiences: ["view", "create", "edit"],
    creatives: ["view", "create", "edit"],
    tracking: ["view"],
    reports: ["view", "create"],
    automations: ["view"],
    integrations: ["view"],
    billing: [],
    settings: [],
  },
};

/** Whether the role may do the action. The owner can always do everything. */
export function can(
  permissions: RolePermissions,
  role: Role,
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  if (role === "owner") return true;
  return permissions[role]?.[resource]?.includes(action) ?? false;
}
