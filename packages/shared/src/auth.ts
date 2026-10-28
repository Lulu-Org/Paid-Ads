import { z } from "zod";
import { currencySchema, timestampSchema } from "./common";

// Workspace the middleware loads from the token. Workspace has no workspaceId,
// so it does not use baseRecordSchema (docs/data-model.md).
// Reserved for GET /me once the web client parses the workspace too (TODO, 2.2).
export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  defaultCurrency: currencySchema,
  defaultLanguage: z.string().min(2),
});

// POST /auth/login. Unknown email and wrong password both answer UNAUTHORIZED.
export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// POST /auth/login response. Fetch the user with GET /me.
export const authSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: timestampSchema,
});

// PATCH /me: only name and language are writable (never role, email, workspaceId).
export const meUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    language: z.string().min(2).optional(),
  })
  .refine((value) => value.name !== undefined || value.language !== undefined, {
    message: "at least one field is required",
  });

export type Workspace = z.infer<typeof workspaceSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type MeUpdateInput = z.infer<typeof meUpdateSchema>;
