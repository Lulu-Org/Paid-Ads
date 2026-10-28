import { z } from "zod";
import { idSchema, listQuerySchema, timestampSchema } from "./common";

// GET /audit-log (docs/api.md, "Audit log"): who changed what, when, under which correlation id.
// Written by the server for every change to a CRM record; read-only.

export const auditActorTypeSchema = z.enum(["user", "ai", "system"]);
export const auditActionSchema = z.enum(["create", "update", "delete"]);

export const auditEntrySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  actorType: auditActorTypeSchema,
  actorId: idSchema.nullable(),
  action: auditActionSchema,
  // contact, company, deal, task, note, segment, custom_field, setting, permission, stage, pipeline,
  // ai_insight, import_job or user.
  entityType: z.string().min(1),
  entityId: idSchema.nullable(),
  // The fields the change set (secrets left out).
  changes: z.record(z.string(), z.unknown()),
  correlationId: z.string().min(1),
  createdAt: timestampSchema,
});

// Newest first. Filter by record (entityType + entityId), by actor or by correlation id.
export const auditListQuerySchema = listQuerySchema.extend({
  entityType: z.string().min(1).optional(),
  entityId: idSchema.optional(),
  actorId: idSchema.optional(),
  correlationId: z.string().min(1).optional(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
