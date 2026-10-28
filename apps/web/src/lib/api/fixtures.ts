import type { User } from "@lulu/shared";

// Sample data from the MagicPath design ("Lulu Paid Ads"), so the web app runs without the API
// (AGENTS.md rule 5). Each area adds its own fixtures here, with the design's names and numbers.

export const DEMO_WORKSPACE_ID = "workspace_demo";
const CREATED = "2026-10-01T09:00:00.000Z";
const base = { workspaceId: DEMO_WORKSPACE_ID, createdAt: CREATED, updatedAt: CREATED, deletedAt: null };

export const demoUsers: User[] = [
  { ...base, id: "user_jamie", name: "Jamie Morgan", email: "jamie@lulu.demo", role: "owner", language: "en" },
  { ...base, id: "user_alex", name: "Alex Rivera", email: "alex@lulu.demo", role: "member", language: "en" },
];
