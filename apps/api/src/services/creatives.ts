import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CreativeCreateInput,
  CreativeListItem,
  CreativeTest,
  CreativeUpdateInput,
  LibraryApiQuery,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import { libraryOrderBy } from '../lib/libraryQuery';
import type { RequestContext } from '../middleware/requestContext';
import type { Creative as CreativeRow, Prisma } from '../generated/prisma/client';

// Creative library, approval and creative tests (docs/api.md "Audiences, creatives, tracking").

const iso = (value: Date) => value.toISOString();
const round2 = (value: number) => Math.round(value * 100) / 100;

function toCreativeListItem(
  row: CreativeRow,
  campaignCount: number,
  winning: boolean,
): CreativeListItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    type: row.type as CreativeListItem['type'],
    fileUrl: row.fileUrl,
    meta: (row.meta ?? {}) as Record<string, string | number>,
    approvalStatus: row.approvalStatus,
    approvedById: row.approvedById,
    campaignCount,
    winning,
  };
}

async function findCreative(workspaceId: string, creativeId: string): Promise<CreativeRow> {
  const row = await scopedDb(workspaceId).creative.findFirst({ where: { id: creativeId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

async function decorate(workspaceId: string, rows: CreativeRow[]): Promise<CreativeListItem[]> {
  if (rows.length === 0) return [];
  const links = await scopedDb(workspaceId).campaignCreative.findMany({
    where: { creativeId: { in: rows.map((row) => row.id) } },
    select: { creativeId: true, role: true },
  });
  const counts = new Map<string, number>();
  const winners = new Set<string>();
  for (const link of links) {
    counts.set(link.creativeId, (counts.get(link.creativeId) ?? 0) + 1);
    if (link.role === 'winner') winners.add(link.creativeId);
  }
  return rows.map((row) => toCreativeListItem(row, counts.get(row.id) ?? 0, winners.has(row.id)));
}

// Files go to local disk for now (UPLOAD_DIR, served at /uploads). Render disks are ephemeral,
// so real object storage is a follow-up; only saveFile changes when that lands.
async function saveFile(workspaceId: string, file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
  const dir = path.join(process.env.UPLOAD_DIR ?? 'uploads', workspaceId);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, fileName), file.buffer);
  const base = (process.env.PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  return `${base}/uploads/${workspaceId}/${fileName}`;
}

export interface CreativeListResult {
  items: CreativeListItem[];
  total: number;
}

export async function listCreatives(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<CreativeListResult> {
  const where: Prisma.CreativeWhereInput = {};
  if (query.q !== undefined) where.name = { contains: query.q, mode: 'insensitive' };

  const creatives = scopedDb(ctx.workspaceId).creative;
  const [rows, total] = await Promise.all([
    creatives.findMany({
      where,
      orderBy: libraryOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    creatives.count({ where }),
  ]);
  return { total, items: await decorate(ctx.workspaceId, rows) };
}

export async function getCreative(
  ctx: RequestContext,
  creativeId: string,
): Promise<CreativeListItem> {
  const row = await findCreative(ctx.workspaceId, creativeId);
  const [item] = await decorate(ctx.workspaceId, [row]);
  return item!;
}

export async function createCreative(
  ctx: RequestContext,
  input: CreativeCreateInput,
  file?: Express.Multer.File,
): Promise<CreativeListItem> {
  const fileUrl = file === undefined ? null : await saveFile(ctx.workspaceId, file);
  const row = await scopedDb(ctx.workspaceId).creative.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      type: input.type,
      fileUrl,
      meta: (input.meta ?? {}),
    },
  });
  return toCreativeListItem(row, 0, false);
}

export async function updateCreative(
  ctx: RequestContext,
  creativeId: string,
  input: CreativeUpdateInput,
): Promise<CreativeListItem> {
  await findCreative(ctx.workspaceId, creativeId);
  const data: Prisma.CreativeUncheckedUpdateInput = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.meta === undefined ? {} : { meta: input.meta }),
  };
  const row = await scopedDb(ctx.workspaceId).creative.update({
    where: { id: creativeId },
    data,
  });
  const [item] = await decorate(ctx.workspaceId, [row]);
  return item!;
}

export async function deleteCreative(ctx: RequestContext, creativeId: string): Promise<void> {
  await findCreative(ctx.workspaceId, creativeId);
  await scopedDb(ctx.workspaceId).creative.delete({ where: { id: creativeId } });
}

export async function approveCreative(
  ctx: RequestContext,
  creativeId: string,
): Promise<CreativeListItem> {
  const existing = await findCreative(ctx.workspaceId, creativeId);
  const row =
    existing.approvalStatus === 'approved'
      ? existing
      : await scopedDb(ctx.workspaceId).creative.update({
          where: { id: creativeId },
          data: { approvalStatus: 'approved', approvedById: ctx.userId },
        });
  const [item] = await decorate(ctx.workspaceId, [row]);
  return item!;
}

// GET /creative-tests: campaigns with two or more creative variants.
export async function listCreativeTests(ctx: RequestContext): Promise<CreativeTest[]> {
  const scoped = scopedDb(ctx.workspaceId);
  const links = await scoped.campaignCreative.findMany({ orderBy: { variant: 'asc' } });

  const byCampaign = new Map<string, typeof links>();
  for (const link of links) {
    const list = byCampaign.get(link.campaignId) ?? [];
    list.push(link);
    byCampaign.set(link.campaignId, list);
  }
  const testIds = [...byCampaign.entries()].filter(([, list]) => list.length >= 2);
  if (testIds.length === 0) return [];

  const [campaigns, creatives] = await Promise.all([
    scoped.campaign.findMany({ where: { id: { in: testIds.map(([id]) => id) } } }),
    scoped.creative.findMany({
      where: { id: { in: testIds.flatMap(([, list]) => list.map((link) => link.creativeId)) } },
    }),
  ]);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const creativeById = new Map(creatives.map((creative) => [creative.id, creative]));

  const tests: CreativeTest[] = [];
  for (const [campaignId, list] of testIds) {
    const campaign = campaignById.get(campaignId);
    if (campaign === undefined) continue;
    const currency = campaign.budgetCurrency;

    const variants = list.map((link) => {
      const spend: number = Number(link.spendAmount);
      const leads: number = Number(link.leads);
      return {
        variant: link.variant,
        creativeId: link.creativeId,
        creativeName: creativeById.get(link.creativeId)?.name ?? '',
        role: link.role as CreativeTest['variants'][number]['role'],
        spend: { amount: spend, currency },
        leads,
        cpl: leads > 0 ? { amount: round2(spend / leads), currency } : null,
      };
    });

    const control = variants.find((variant) => variant.role === 'control')?.cpl ?? null;
    const winner = variants.find((variant) => variant.role === 'winner')?.cpl ?? null;
    const winnerLead =
      control !== null && winner !== null && control.amount > 0
        ? (control.amount - winner.amount) / control.amount
        : null;

    tests.push({ campaignId, campaignName: campaign.name, variants, winnerLead });
  }
  return tests;
}