import type {
  Attribution,
  AttributionQuery,
  ConversionEvent,
  ConversionEventCreateInput,
  ConversionEventUpdateInput,
  LibraryApiQuery,
  TrackingHealth,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import { libraryOrderBy } from '../lib/libraryQuery';
import type { RequestContext } from '../middleware/requestContext';
import type { ConversionEvent as ConversionEventRow, Prisma } from '../generated/prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTRIBUTION_DAYS = 30;
const iso = (value: Date) => value.toISOString();
const isoDay = (value: Date) => value.toISOString().slice(0, 10);
const round2 = (value: number) => Math.round(value * 100) / 100;

function toConversionEventDto(row: ConversionEventRow): ConversionEvent {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    source: row.source as ConversionEvent['source'],
    value:
      row.valueAmount === null || row.valueCurrency === null
        ? null
        : { amount: row.valueAmount.toNumber(), currency: row.valueCurrency },
    platforms: row.platforms,
    health: row.health as ConversionEvent['health'],
    lastReceivedAt: row.lastReceivedAt === null ? null : iso(row.lastReceivedAt),
  };
}

async function findConversionEvent(
  workspaceId: string,
  eventId: string,
): Promise<ConversionEventRow> {
  const row = await scopedDb(workspaceId).conversionEvent.findFirst({ where: { id: eventId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

// ---------- Conversion events ----------

export interface ConversionEventListResult {
  items: ConversionEvent[];
  total: number;
}

export async function listConversionEvents(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<ConversionEventListResult> {
  const where: Prisma.ConversionEventWhereInput = {};
  if (query.platform !== undefined) where.platforms = { has: query.platform };
  if (query.q !== undefined) where.name = { contains: query.q, mode: 'insensitive' };

  const events = scopedDb(ctx.workspaceId).conversionEvent;
  const [rows, total] = await Promise.all([
    events.findMany({
      where,
      orderBy: libraryOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    events.count({ where }),
  ]);
  return { total, items: rows.map(toConversionEventDto) };
}

export async function createConversionEvent(
  ctx: RequestContext,
  input: ConversionEventCreateInput,
): Promise<ConversionEvent> {
  const row = await scopedDb(ctx.workspaceId).conversionEvent.create({
    data: {
        workspaceId: ctx.workspaceId,
        name: input.name,
        source: input.source,
        valueAmount: input.value === null ? null : input.value.amount,
        valueCurrency: input.value === null ? null : input.value.currency,
        platforms: input.platforms,
        health: 'needs_attention',
    },
  });
  return toConversionEventDto(row);
}

export async function updateConversionEvent(
  ctx: RequestContext,
  eventId: string,
  input: ConversionEventUpdateInput,
): Promise<ConversionEvent> {
  await findConversionEvent(ctx.workspaceId, eventId);
  const data: Prisma.ConversionEventUncheckedUpdateInput = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.platforms === undefined ? {} : { platforms: input.platforms }),
    // value null = dynamic, so amount and currency are cleared together.
    ...(input.value === undefined
      ? {}
      : {
          valueAmount: input.value === null ? null : input.value.amount,
          valueCurrency: input.value === null ? null : input.value.currency,
        }),
  };
  const row = await scopedDb(ctx.workspaceId).conversionEvent.update({
    where: { id: eventId },
    data,
  });
  return toConversionEventDto(row);
}

export async function deleteConversionEvent(ctx: RequestContext, eventId: string): Promise<void> {
  await findConversionEvent(ctx.workspaceId, eventId);
  await scopedDb(ctx.workspaceId).conversionEvent.delete({ where: { id: eventId } });
}

// ---------- Metric-day helper ----------

// Same rule as the Overview: "today" is the newest day with synced metrics.
async function newestMetricDate(workspaceId: string): Promise<Date | null> {
  const row = await scopedDb(workspaceId).campaignMetricDay.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return row === null ? null : row.date;
}

// ---------- Tracking health ----------

export async function getTrackingHealth(ctx: RequestContext): Promise<TrackingHealth> {
  const scoped = scopedDb(ctx.workspaceId);
  const [events, newest] = await Promise.all([
    scoped.conversionEvent.findMany({ select: { health: true } }),
    newestMetricDate(ctx.workspaceId),
  ]);
  const needsAttention = events.filter((event) => event.health === 'needs_attention').length;

  let eventsToday = 0;
  let changeVsYesterday: number | null = null;
  if (newest !== null) {
    const yesterday = new Date(newest.getTime() - DAY_MS);
    const rows = await scoped.campaignMetricDay.findMany({
      where: { date: { gte: yesterday, lte: newest } },
      select: { date: true, conversions: true },
    });
    const today = isoDay(newest);
    let previous = 0;
    for (const row of rows) {
      if (isoDay(row.date) === today) eventsToday += row.conversions;
      else previous += row.conversions;
    }
    changeVsYesterday = previous === 0 ? null : (eventsToday - previous) / previous;
  }

  return {
    healthy: events.length > 0 && needsAttention === 0,
    eventsToday,
    changeVsYesterday,
    needsAttention,
  };
}

// ---------- Attribution ----------

export async function getAttribution(
  ctx: RequestContext,
  query: AttributionQuery,
): Promise<Attribution> {
  const scoped = scopedDb(ctx.workspaceId);
  const [events, campaigns, newest] = await Promise.all([
    scoped.conversionEvent.findMany({ select: { health: true } }),
    scoped.campaign.findMany({ select: { id: true, platform: true, budgetCurrency: true } }),
    newestMetricDate(ctx.workspaceId),
  ]);

  const unmappedEvents = events.filter((event) => event.health === 'needs_attention').length;
  const dataQuality = events.length === 0 ? 0 : (events.length - unmappedEvents) / events.length;
  const currency = campaigns[0]?.budgetCurrency ?? 'EUR';

  const platformOf = new Map(campaigns.map((campaign) => [campaign.id, campaign.platform]));
  const revenueByPlatform = new Map<string, number>();
  for (const campaign of campaigns) revenueByPlatform.set(campaign.platform, 0);

  if (newest !== null) {
    const from = new Date(newest.getTime() - (ATTRIBUTION_DAYS - 1) * DAY_MS);
    const rows = await scoped.campaignMetricDay.findMany({
      where: { date: { gte: from, lte: newest }, currency },
      select: { campaignId: true, revenueAmount: true },
    });
    for (const row of rows) {
      const platform = platformOf.get(row.campaignId);
      if (platform === undefined) continue;
      revenueByPlatform.set(
        platform,
        (revenueByPlatform.get(platform) ?? 0) + row.revenueAmount.toNumber(),
      );
    }
  }

  const byPlatform = [...revenueByPlatform.entries()].map(([platform, revenue]) => ({
    platform: platform as Attribution['byPlatform'][number]['platform'],
    revenue: { amount: round2(revenue), currency },
  }));
  const total = byPlatform.reduce((sum, entry) => sum + entry.revenue.amount, 0);

  return {
    model: query.model,
    dataQuality,
    revenue: { amount: round2(total), currency },
    unmappedEvents,
    byPlatform,
  };
}