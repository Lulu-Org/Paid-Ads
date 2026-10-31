import type {
  AudienceCreateInput,
  AudienceListItem,
  AudienceUpdateInput,
  LibraryApiQuery,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import { decimalToNumber, libraryOrderBy } from '../lib/libraryQuery';
import type { RequestContext } from '../middleware/requestContext';
import type { Audience as AudienceRow, Prisma } from '../generated/prisma/client';

// Audience library (docs/api.md "Audiences, creatives, tracking").
// All reads and writes go through scopedDb so the workspace filter and soft deletes always apply.

const iso = (value: Date) => value.toISOString();

function toAudienceListItem(
  row: AudienceRow,
  campaignCount: number,
  syncing: boolean,
): AudienceListItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    source: row.source as AudienceListItem['source'],
    sizeEstimate: row.sizeEstimate,
    consentBasis: row.consentBasis,
    platforms: row.platforms,
    lastSyncedAt: row.lastSyncedAt === null ? null : iso(row.lastSyncedAt),
    description: row.description,
    matchRate: decimalToNumber(row.matchRate),
    exclusions: row.exclusions,
    campaignCount,
    syncing,
  };
}

async function findAudience(workspaceId: string, audienceId: string): Promise<AudienceRow> {
  const row = await scopedDb(workspaceId).audience.findFirst({ where: { id: audienceId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

async function decorate(workspaceId: string, rows: AudienceRow[]): Promise<AudienceListItem[]> {
  if (rows.length === 0) return [];
  const scoped = scopedDb(workspaceId);
  const [links, runs] = await Promise.all([
    scoped.campaignAudience.findMany({
      where: { audienceId: { in: rows.map((row) => row.id) } },
      select: { audienceId: true },
    }),
    scoped.syncRun.findMany({
      where: { scope: 'audiences', status: { in: ['queued', 'running'] } },
      select: { platform: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const link of links) counts.set(link.audienceId, (counts.get(link.audienceId) ?? 0) + 1);
  const syncingPlatforms = new Set<string>(runs.map((run) => run.platform));

  return rows.map((row) =>
    toAudienceListItem(
      row,
      counts.get(row.id) ?? 0,
      row.platforms.some((platform) => syncingPlatforms.has(platform)),
    ),
  );
}

export interface AudienceListResult {
  items: AudienceListItem[];
  total: number;
}

export async function listAudiences(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<AudienceListResult> {
  const where: Prisma.AudienceWhereInput = {};
  if (query.platform !== undefined) where.platforms = { has: query.platform };
  if (query.q !== undefined) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const audiences = scopedDb(ctx.workspaceId).audience;
  const [rows, total] = await Promise.all([
    audiences.findMany({
      where,
      orderBy: libraryOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    audiences.count({ where }),
  ]);
  return { total, items: await decorate(ctx.workspaceId, rows) };
}

export async function getAudience(
  ctx: RequestContext,
  audienceId: string,
): Promise<AudienceListItem> {
  const row = await findAudience(ctx.workspaceId, audienceId);
  const [item] = await decorate(ctx.workspaceId, [row]);
  return item!;
}

export async function createAudience(
  ctx: RequestContext,
  input: AudienceCreateInput,
): Promise<AudienceListItem> {
  const row = await scopedDb(ctx.workspaceId).audience.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      source: input.source,
      consentBasis: input.consentBasis,
      platforms: input.platforms,
    },
  });
  return toAudienceListItem(row, 0, false);
}

export async function updateAudience(
  ctx: RequestContext,
  audienceId: string,
  input: AudienceUpdateInput,
): Promise<AudienceListItem> {
  await findAudience(ctx.workspaceId, audienceId);
  const data: Prisma.AudienceUncheckedUpdateInput = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.consentBasis === undefined ? {} : { consentBasis: input.consentBasis }),
    ...(input.platforms === undefined ? {} : { platforms: input.platforms }),
  };
  const row = await scopedDb(ctx.workspaceId).audience.update({
    where: { id: audienceId },
    data,
  });
  const [item] = await decorate(ctx.workspaceId, [row]);
  return item!;
}

export async function deleteAudience(ctx: RequestContext, audienceId: string): Promise<void> {
  await findAudience(ctx.workspaceId, audienceId);
  await scopedDb(ctx.workspaceId).audience.delete({ where: { id: audienceId } });
}