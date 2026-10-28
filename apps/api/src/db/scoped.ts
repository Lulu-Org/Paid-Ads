// Workspace-scoped, soft-delete-enforcing Prisma client.
//
// To scope a new model: add its Prisma delegate name (lowercase model name,
// e.g. 'contact') to SCOPED_MODELS below. That single change wires the model
// into every rule here: automatic workspaceId + deletedAt filtering, unique
// lookups confined to the workspace, workspaceId stamped on create, forced
// into update/upsert where, and delete converted to a soft delete.
// The model must have workspaceId, deletedAt and the base timestamp fields.
//
// The returned client is typed as the base Db: the extension changes runtime
// behavior only, and the call-site API (models, args, results) is identical.
import { Prisma } from '../generated/prisma/client';
import { db, type Db } from './prisma';

export const SCOPED_MODELS = [
  'user',
  'contact',
  'company',
  'pipeline',
  'stage',
  'deal',
  'task',
  'note',
  'activity',
  'segment',
  'importJob',
  'importRow',
  'aiInsight',
  'customField',
  'setting',
  'permission',
] as const;

type WhereArg = Record<string, unknown>;

const getExtensionContext = (
  Prisma as unknown as {
    getExtensionContext: (context: unknown) => unknown;
  }
).getExtensionContext;

function applyScope(where: WhereArg | undefined, workspaceId: string): WhereArg {
  const scoped: WhereArg = { ...(where ?? {}), workspaceId };
  if (scoped.deletedAt === undefined) {
    scoped.deletedAt = null;
  }
  return scoped;
}

function scopingQuery(workspaceId: string) {
  const scopedWhere = (where: WhereArg | undefined): WhereArg => applyScope(where, workspaceId);

  const handlers = {
    async findMany({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async findFirst({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async findFirstOrThrow({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async count({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async aggregate({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async groupBy({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async findUnique({
      args,
      query,
    }: {
      args: { where: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = { ...args.where, workspaceId, deletedAt: null };
      return query(args);
    },
    async findUniqueOrThrow({
      args,
      query,
    }: {
      args: { where: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = { ...args.where, workspaceId, deletedAt: null };
      return query(args);
    },
    async create({
      args,
      query,
    }: {
      args: { data: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      const given = args.data.workspaceId;
      if (given !== undefined && given !== workspaceId) {
        throw new Error(
          `WORKSPACE_MISMATCH: cannot create row for workspace ${JSON.stringify(given)} in scope ${workspaceId}`,
        );
      }
      args.data = { ...args.data, workspaceId };
      return query(args);
    },
    async createMany({
      args,
      query,
    }: {
      args: { data: WhereArg | WhereArg[] };
      query: (a: unknown) => Promise<unknown>;
    }) {
      const rows = Array.isArray(args.data) ? args.data : [args.data];
      for (const row of rows) {
        const given = row.workspaceId;
        if (given !== undefined && given !== workspaceId) {
          throw new Error(
            `WORKSPACE_MISMATCH: cannot create row for workspace ${JSON.stringify(given)} in scope ${workspaceId}`,
          );
        }
        row.workspaceId = workspaceId;
      }
      return query(args);
    },
    async update({
      args,
      query,
    }: {
      args: { where: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = { ...args.where, workspaceId };
      return query(args);
    },
    async updateMany({
      args,
      query,
    }: {
      args: { where?: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = scopedWhere(args.where);
      return query(args);
    },
    async upsert({
      args,
      query,
    }: {
      args: { where: WhereArg; create: WhereArg; update: WhereArg };
      query: (a: unknown) => Promise<unknown>;
    }) {
      args.where = { ...args.where, workspaceId };
      args.create = { ...args.create, workspaceId };
      return query(args);
    },
  };

  const query: Record<string, typeof handlers> = {};
  for (const model of SCOPED_MODELS) {
    query[model] = handlers;
  }

  const defineExtension = (
    Prisma as unknown as {
      defineExtension: <T>(extension: T) => T;
    }
  ).defineExtension;

  return defineExtension({
    name: 'workspaceScoping',
    // Prisma's types demand literal model keys; SCOPED_MODELS is built at runtime.
    query: query as never,
  });
}

function softDeleteModels() {
  const models: Record<string, object> = {};

  for (const model of SCOPED_MODELS) {
    models[model] = {
      async delete(args: { where: WhereArg }) {
        const ctx = getExtensionContext(this) as {
          findFirstOrThrow: (a: unknown) => Promise<Record<string, unknown>>;
          updateMany: (a: unknown) => Promise<unknown>;
        };
        const row = await ctx.findFirstOrThrow({ where: args.where });
        await ctx.updateMany({ where: { id: row.id }, data: { deletedAt: new Date() } });
        return row;
      },
      async deleteMany(args: { where?: WhereArg }) {
        const ctx = getExtensionContext(this) as {
          updateMany: (a: unknown) => Promise<{ count: number }>;
        };
        return ctx.updateMany({ where: args.where ?? {}, data: { deletedAt: new Date() } });
      },
    };
  }

  const defineExtension = (
    Prisma as unknown as {
      defineExtension: <T>(extension: T) => T;
    }
  ).defineExtension;

  return defineExtension({
    name: 'softDelete',
    model: models as never,
  });
}

export function scopedDb(workspaceId: string): Db {
  const client = db as unknown as {
    $extends: (extension: unknown) => {
      $extends: (extension: unknown) => Db;
    };
  };
  return client.$extends(scopingQuery(workspaceId)).$extends(softDeleteModels());
}

export type ScopedDb = Db;

/**
 * A database handle inside a transaction, for services that a caller runs as part of a larger change
 * (AI acceptance, imports). Pass one opened on scopedDb(workspaceId), never on the base client, so
 * the workspace rules still apply.
 */
export type DbTx = Prisma.TransactionClient;
