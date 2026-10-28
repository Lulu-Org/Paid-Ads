import type { AuditEntry, AuditListQuery } from '@lulu/shared';
import { db } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';
import type { RequestContext } from '../middleware/requestContext';

// GET /audit-log. The rows are written by db/audit.ts for every change; this only reads them, always
// inside the caller's workspace (audit rows are not soft deleted, so the base client is used with an
// explicit workspace filter).
export async function listAudit(
  ctx: RequestContext,
  query: AuditListQuery,
): Promise<{ items: AuditEntry[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    workspaceId: ctx.workspaceId,
    ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
    ...(query.entityId === undefined ? {} : { entityId: query.entityId }),
    ...(query.actorId === undefined ? {} : { actorId: query.actorId }),
    ...(query.correlationId === undefined ? {} : { correlationId: query.correlationId }),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      actorType: row.actorType,
      actorId: row.actorId,
      action: row.action as AuditEntry['action'],
      entityType: row.entityType,
      entityId: row.entityId,
      changes: row.changes as Record<string, unknown>,
      correlationId: row.correlationId,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
  };
}
