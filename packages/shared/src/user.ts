import { z } from "zod";
import { baseRecordSchema, listQuerySchema } from "./common";

export const roleSchema = z.enum(["owner", "admin", "member"]);

// GET /users and GET /me (the user part).
export const userSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  email: z.email(),
  role: roleSchema,
  language: z.string().min(2),
});

// GET /users: name or createdAt, with "-" for descending. Default name.
export const userSortSchema = z.enum(["name", "-name", "createdAt", "-createdAt"]);

export const userListQuerySchema = listQuerySchema.extend({
  sort: userSortSchema.optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type User = z.infer<typeof userSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
