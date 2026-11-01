import type {
  Incident,
  OperationsSummary,
  SyncRun,
  SyncRunsQuery,
  WebhookEvent,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { enqueueAdsSync } from '../jobs/queues';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import type {
  Incident as IncidentRow,
  SyncRun as SyncRunRow,
  WebhookEvent as WebhookEventRow,
} from '../generated/prisma/client';

// Operations: sync health, incidents, webhooks, sync history (docs/api.md "operations").

const DAY_MS = 86_400_000;
const iso = (value: Date) => value.toISOString();

function toIncidentDto(row: IncidentRow): Incident {
  return {
    id: row.id,
    platform: row.platform,
    kind: row.kind as Incident['kind'],
    subject: row.subject,
    retryAt: row.retryAt === null ? null : iso(row.retryAt),
  };
}

function toWebhookDto(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    platform: row.platform,
    eventType: row.eventType,
    campaignId: row.campaignId,
    receivedAt: iso(row.receivedAt),
  };
}

function toSyncRunDto(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    adAccountId: row.adAccountId,
    platform: row.platform,
    kind: row.kind as SyncRun['kind'],
    scope: row.scope as SyncRun['scope'],
    status: row.status,
    startedAt: iso(row.startedAt),
    finishedAt: row.finishedAt === null ? null : iso(row.finishedAt),
    recordsProcessed: row.recordsProcessed,
    error: row.error,
  };
}

// "Today" is the day of the newest sync run, like the Overview's newest metric day.
export async function getOperations(ctx: RequestContext): Promise<OperationsSummary> {
  const scoped = scopedDb(ctx.workspaceId);
  const [accounts, incidentRows, webhookRows, newestRun, campaigns] = await Promise.all([
    scoped.adAccount.findMany({ select: { status: true, lastSyncAt: true } }),
    scoped.incident.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: 'desc' } }),
    scoped.webhookEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 10 }),
    scoped.syncRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
    scoped.campaign.findMany({
      where: { status: { in: ['live', 'paused'] } },
      select: { externalId: true },
    }),
  ]);

  let jobsToday = 0;
  let succeeded = 0;
  if (newestRun !== null) {
    const start = new Date(
      Date.UTC(
        newestRun.startedAt.getUTCFullYear(),
        newestRun.startedAt.getUTCMonth(),
        newestRun.startedAt.getUTCDate(),
      ),
    );
    const runs = await scoped.syncRun.findMany({
      where: { startedAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } },
      select: { status: true },
    });
    jobsToday = runs.length;
    succeeded = runs.filter((run) => run.status === 'succeeded').length;
  }

  const syncTimes = accounts.flatMap((account) =>
    account.lastSyncAt === null ? [] : [account.lastSyncAt.getTime()],
  );
  // Stand-in until the providers (C0) can compare with each platform: the share of live and
  // paused campaigns that are linked to a platform campaign.
  const linked = campaigns.filter((campaign) => campaign.externalId !== null).length;

  return {
    healthy: incidentRows.length === 0 && !accounts.some((a) => a.status === 'needs_attention'),
    providers: accounts.filter((account) => account.status === 'connected').length,
    lastSyncAt: syncTimes.length === 0 ? null : iso(new Date(Math.max(...syncTimes))),
    jobsToday,
    successRate: jobsToday === 0 ? 1 : succeeded / jobsToday,
    incidents: incidentRows.map(toIncidentDto),
    webhooks: webhookRows.map(toWebhookDto),
    reconciled: campaigns.length === 0 ? 1 : linked / campaigns.length,
  };
}

export async function listSyncRuns(
  ctx: RequestContext,
  query: SyncRunsQuery,
): Promise<{ items: SyncRun[]; total: number }> {
  const runs = scopedDb(ctx.workspaceId).syncRun;
  const [rows, total] = await Promise.all([
    runs.findMany({
      orderBy: { startedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    runs.count(),
  ]);
  return { total, items: rows.map(toSyncRunDto) };
}

// Only rate-limited and failed syncs retry by themselves. Expired auth and consent reviews need a person.
export async function retryIncident(
  ctx: RequestContext,
  incidentId: string,
): Promise<OperationsSummary> {
  const scoped = scopedDb(ctx.workspaceId);
  const incident = await scoped.incident.findFirst({
    where: { id: incidentId, resolvedAt: null },
  });
  if (incident === null) throw AppError.notFound('NOT_FOUND');
  if (incident.kind !== 'rate_limited' && incident.kind !== 'sync_failed') {
    throw AppError.conflict('CONFLICT', { kind: incident.kind });
  }
  const account = await scoped.adAccount.findFirst({
    where: { platform: incident.platform, status: { not: 'disconnected' } },
  });
  if (account === null) throw AppError.conflict('CONFLICT', { platform: incident.platform });

  await enqueueAdsSync({ workspaceId: ctx.workspaceId, adAccountId: account.id });
  await scoped.incident.update({ where: { id: incident.id }, data: { retryAt: new Date() } });
  return getOperations(ctx);
}

// Until C0 there is no provider to compare with, so this recomputes and returns the summary.
export function reconcile(ctx: RequestContext): Promise<OperationsSummary> {
  return getOperations(ctx);
}
