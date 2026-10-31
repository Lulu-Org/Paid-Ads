import { Prisma, type PrismaClient } from '../generated/prisma/client';
import { currentActor } from '../lib/actorContext';

// Audit log and domain events for every change to a CRM record (Lulu platform architecture: "every
// mutation creates audit and relevant domain evidence"). This sits on the base Prisma client, so it
// sees every write: through scopedDb, through transactions and through the seed.
//
// Known limit, until the platform outbox exists: the audit row and the event are written right after
// the change, in their own transaction. If an outer transaction later rolls back, its audit row stays.
// They are never lost for a change that was kept.

// Prisma model -> entity type in audit rows and event names (contact.updated, ai_insight.created ...).
export const AUDITED_ENTITIES: Record<string, string> = {
  setting: 'setting',
  permission: 'permission',
  user: 'user',
  adAccount: 'adAccount',
  campaign: 'campaign',
  campaignMetricDay: 'campaignMetricDay',
  campaignPlanStep: 'campaignPlanStep',
  audience: 'audience',
  creative: 'creative',
  campaignCreative: 'campaignCreative',
  campaignAudience: 'campaignAudience',
  conversionEvent: 'conversionEvent',
  automationRule: 'automationRule',
  automationActivity: 'automationActivity',
  spendLimit: 'spendLimit',
  approvalPolicy: 'approvalPolicy',
  teamMember: 'teamMember',
  paymentMethod: 'paymentMethod',
  statement: 'statement',
  incident: 'incident',
  webhookEvent: 'webhookEvent',
  approvalRequest: 'approvalRequest',
  report: 'report',
  syncRun: 'syncRun',
};

// The domain events Paid Ads publishes: <entity>.created / .updated / .deleted.
export const PUBLISHED_EVENT_TYPES = Object.values(AUDITED_ENTITIES).flatMap((entity) =>
  ['created', 'updated', 'deleted'].map((verb) => `${entity}.${verb}`),
);

// Never copied into audit rows or events.
const SECRET_FIELDS = new Set(['passwordHash', 'tokenEncrypted']);

const MUTATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const lowerFirst = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** The fields a write set, as plain JSON, without secrets or nested relation writes. */
export function changedFields(data: unknown): Row {
  if (!isRow(data)) return {};
  const out: Row = {};
  for (const [key, value] of Object.entries(data)) {
    if (SECRET_FIELDS.has(key) || value === undefined) continue;
    // Nested writes ({ connect: ... }) and Prisma operators ({ increment: 1 }) are noted, not copied.
    out[key] =
      isRow(value) && !(value instanceof Date) && !Prisma.Decimal.isDecimal(value)
        ? '[nested]'
        : value;
  }
  return JSON.parse(JSON.stringify(out)) as Row;
}

export function auditAction(operation: string, data: unknown): 'create' | 'update' | 'delete' {
  if (operation.startsWith('create') || operation === 'upsert') return 'create';
  if (operation.startsWith('delete')) return 'delete';
  // scopedDb turns delete into an update that only sets deletedAt.
  if (isRow(data) && Object.keys(data).length === 1 && data.deletedAt instanceof Date)
    return 'delete';
  return 'update';
}

const VERB = { create: 'created', update: 'updated', delete: 'deleted' } as const;

export function withAudit(base: PrismaClient): PrismaClient {
  const record = async (model: string, operation: string, args: Row, result: unknown) => {
    const entityType = AUDITED_ENTITIES[lowerFirst(model)];
    if (entityType === undefined) return;
    // Bulk writes that matched nothing changed nothing.
    if (isRow(result) && typeof result.count === 'number' && result.count === 0) return;

    const actor = currentActor();
    const where = isRow(args.where) ? args.where : {};
    const data = operation === 'upsert' ? args.create : args.data;
    const fromResult = isRow(result) ? result : {};
    const workspaceId = [
      fromResult.workspaceId,
      isRow(data) ? data.workspaceId : undefined,
      where.workspaceId,
      actor.workspaceId,
    ].find((value): value is string => typeof value === 'string');
    if (workspaceId === undefined) return; // Nothing tenant-owned to record (e.g. a workspace-less test write).

    const entityId =
      [fromResult.id, where.id].find((value): value is string => typeof value === 'string') ?? null;
    const action = auditAction(operation, data);
    const changes = Array.isArray(data) ? { count: data.length } : changedFields(data);
    const actorType = actor.actorType;
    const actorId = actor.actorType === 'user' ? actor.actorId : null;

    await base.$transaction([
      base.auditLog.create({
        data: {
          workspaceId,
          actorType,
          actorId,
          action,
          entityType,
          entityId,
          changes: changes as Prisma.InputJsonValue,
          correlationId: actor.correlationId,
        },
      }),
      base.outboxEvent.create({
        data: {
          workspaceId,
          eventType: `${entityType}.${VERB[action]}`,
          aggregateType: entityType,
          aggregateId: entityId,
          actorType,
          actorId,
          correlationId: actor.correlationId,
          // Ids and the names of the fields that changed, not their values: consumers read the record.
          payload: { id: entityId, fields: Object.keys(changes) },
        },
      }),
    ]);
  };

  return base.$extends({
    name: 'auditAndOutbox',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (MUTATIONS.has(operation)) await record(model, operation, args, result);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}
