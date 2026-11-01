import {
  buildReport,
  type CampaignMetricDay,
  type LibraryApiQuery,
  type Report,
  type ReportCreateInput,
  type ReportRun,
  type ReportRunQuery,
  type ReportUpdateInput,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import { libraryOrderBy } from '../lib/libraryQuery';
import type { RequestContext } from '../middleware/requestContext';
import type { Prisma, Report as ReportRow } from '../generated/prisma/client';
import { toCampaignDto, toCampaignMetricDayDto } from './campaigns';

// Saved reports and report runs (docs/api.md "Overview, planning and reports").

const DAY_MS = 86_400_000;
const iso = (value: Date) => value.toISOString();
const isoDay = (value: Date) => value.toISOString().slice(0, 10);

function toReportDto(row: ReportRow): Report {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    view: row.view as Report['view'],
    schedule: row.schedule,
    recipients: row.recipients,
  };
}

async function findReport(workspaceId: string, reportId: string): Promise<ReportRow> {
  const row = await scopedDb(workspaceId).report.findFirst({ where: { id: reportId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

export async function listReports(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<{ items: Report[]; total: number }> {
  const where: Prisma.ReportWhereInput = {};
  if (query.q !== undefined) where.name = { contains: query.q, mode: 'insensitive' };
  const reports = scopedDb(ctx.workspaceId).report;
  const [rows, total] = await Promise.all([
    reports.findMany({
      where,
      orderBy: libraryOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    reports.count({ where }),
  ]);
  return { total, items: rows.map(toReportDto) };
}

export async function getReport(ctx: RequestContext, reportId: string): Promise<Report> {
  return toReportDto(await findReport(ctx.workspaceId, reportId));
}

export async function createReport(ctx: RequestContext, input: ReportCreateInput): Promise<Report> {
  const row = await scopedDb(ctx.workspaceId).report.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      view: input.view,
      schedule: input.schedule,
      recipients: input.recipients,
    },
  });
  return toReportDto(row);
}

export async function updateReport(
  ctx: RequestContext,
  reportId: string,
  input: ReportUpdateInput,
): Promise<Report> {
  await findReport(ctx.workspaceId, reportId);
  const data: Prisma.ReportUncheckedUpdateInput = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.view === undefined ? {} : { view: input.view }),
    ...(input.schedule === undefined ? {} : { schedule: input.schedule }),
    ...(input.recipients === undefined ? {} : { recipients: input.recipients }),
  };
  const row = await scopedDb(ctx.workspaceId).report.update({ where: { id: reportId }, data });
  return toReportDto(row);
}

export async function deleteReport(ctx: RequestContext, reportId: string): Promise<void> {
  await findReport(ctx.workspaceId, reportId);
  await scopedDb(ctx.workspaceId).report.delete({ where: { id: reportId } });
}

// Runs buildReport over the campaigns and the metric days for the range and the period before it.
export async function runReport(ctx: RequestContext, query: ReportRunQuery): Promise<ReportRun> {
  const scoped = scopedDb(ctx.workspaceId);
  const from = Date.parse(`${query.from}T00:00:00Z`);
  const to = Date.parse(`${query.to}T00:00:00Z`);
  const length = to - from + DAY_MS;

  const [campaigns, dayRows] = await Promise.all([
    scoped.campaign.findMany(),
    scoped.campaignMetricDay.findMany({
      where: { date: { gte: new Date(from - length), lte: new Date(to) } },
      orderBy: { date: 'asc' },
    }),
  ]);

  const days: Record<string, CampaignMetricDay[]> = {};
  for (const row of dayRows) {
    (days[row.campaignId] ??= []).push(toCampaignMetricDayDto(row));
  }

  return buildReport(
    {
      campaigns: campaigns.map(toCampaignDto),
      days,
      currency: campaigns[0]?.budgetCurrency ?? 'EUR',
    },
    { from: query.from, to: query.to, platforms: query.platforms },
  );
}

// A saved report runs over its own view: the last rangeDays days up to the newest synced day.
// The view's `compare` option is stored but buildReport always compares with the previous period.
export async function runSavedReport(ctx: RequestContext, reportId: string): Promise<ReportRun> {
  const report = await findReport(ctx.workspaceId, reportId);
  const view = report.view as Report['view'];
  const newest = await scopedDb(ctx.workspaceId).campaignMetricDay.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  const end = newest?.date ?? new Date();
  const start = new Date(end.getTime() - (view.rangeDays - 1) * DAY_MS);
  return runReport(ctx, {
    from: isoDay(start),
    to: isoDay(end),
    platforms: view.platforms ?? [],
  });
}
