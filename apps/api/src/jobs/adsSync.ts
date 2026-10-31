import { scopedDb } from '../db/scoped';
import type { Campaign as CampaignRow, Prisma } from '../generated/prisma/client';
import { runAs } from '../lib/actorContext';
import { AppError } from '../lib/errors';
import { getAdsProvider } from '../providers';
import { toProviderAccount } from '../providers/account';
import type { AdsSyncPayload } from './queues';

// Pulls campaigns and daily metrics from an ad platform (docs/api.md "Background jobs"). Independent
// of BullMQ so tests and scripts can call it directly. Every write is idempotent: campaigns match on
// workspace + platform + external id and metric days on their unique (campaign, date) key.

const DAY_MS = 86_400_000;
const METRIC_WINDOW_DAYS = 30;

export interface AdsSyncResult {
  syncRunId: string;
  campaigns: number;
  metricDays: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function resolveOwnerId(workspaceId: string): Promise<string> {
  const scoped = scopedDb(workspaceId);
  const owner = await scoped.user.findFirst({
    where: { role: 'owner' },
    orderBy: { createdAt: 'asc' },
  });
  const fallback = owner ?? (await scoped.user.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (fallback === null) {
    throw new Error(`Workspace ${workspaceId} has no user to own synced campaigns`);
  }
  return fallback.id;
}

export function processAdsSync(payload: AdsSyncPayload): Promise<AdsSyncResult> {
  return runAs(
    {
      actorType: 'system',
      workspaceId: payload.workspaceId,
      ...(payload.correlationId === undefined ? {} : { correlationId: payload.correlationId }),
    },
    async () => {
      const scoped = scopedDb(payload.workspaceId);
      const account = await scoped.adAccount.findFirst({ where: { id: payload.adAccountId } });
      if (account === null) throw AppError.notFound('NOT_FOUND');

      const syncRun =
        payload.syncRunId === undefined
          ? await scoped.syncRun.create({
              data: {
                workspaceId: payload.workspaceId,
                adAccountId: account.id,
                platform: account.platform,
                kind: 'sync',
                scope: 'campaign_performance',
                status: 'running',
              },
            })
          : await scoped.syncRun.update({
              where: { id: payload.syncRunId },
              data: { status: 'running', startedAt: new Date(), error: null },
            });

      try {
        if (account.status === 'disconnected') {
          throw new Error(`Ad account ${account.id} is disconnected`);
        }
        const providerAccount = toProviderAccount(account);
        const provider = getAdsProvider(account.platform);

        const externalCampaigns = await provider.listCampaigns(providerAccount);
        const ownerId = await resolveOwnerId(payload.workspaceId);
        const campaigns: CampaignRow[] = [];

        for (const external of externalCampaigns) {
          const existing = await scoped.campaign.findFirst({
            where: { platform: account.platform, externalId: external.externalId },
          });
          const data: Prisma.CampaignUncheckedCreateInput = {
            workspaceId: payload.workspaceId,
            adAccountId: account.id,
            platform: account.platform,
            externalId: external.externalId,
            name: external.name,
            status: external.status,
            objective: external.objective,
            audienceSummary: external.audienceSummary,
            startAt: external.startAt,
            endAt: external.endAt,
            budgetAmount: external.budget.amount,
            budgetCurrency: external.budget.currency,
            ownerId,
          };
          campaigns.push(
            existing === null
              ? await scoped.campaign.create({ data })
              : await scoped.campaign.update({ where: { id: existing.id }, data }),
          );
        }

        const byExternalId = new Map(
          campaigns.map((campaign) => [campaign.externalId, campaign] as const),
        );
        const now = new Date();
        const from = startOfUtcDay(new Date(now.getTime() - (METRIC_WINDOW_DAYS - 1) * DAY_MS));
        const to = startOfUtcDay(now);
        const externalMetrics = await provider.metrics(providerAccount, from, to);

        let metricDays = 0;
        for (const metric of externalMetrics) {
          const campaign = byExternalId.get(metric.externalId);
          if (campaign === undefined) continue;
          const date = startOfUtcDay(metric.date);
          const values = {
            impressions: metric.impressions,
            clicks: metric.clicks,
            conversions: metric.conversions,
            leads: metric.leads,
            calls: metric.calls,
            spendAmount: metric.spend.amount,
            revenueAmount: metric.revenue.amount,
            currency: metric.spend.currency,
          };
          await scoped.campaignMetricDay.upsert({
            where: {
              workspaceId_campaignId_date: {
                workspaceId: payload.workspaceId,
                campaignId: campaign.id,
                date,
              },
            },
            update: values,
            create: {
              workspaceId: payload.workspaceId,
              campaignId: campaign.id,
              date,
              ...values,
            },
          });
          metricDays += 1;
        }

        await scoped.adAccount.update({
          where: { id: account.id },
          data: { status: 'connected', lastSyncAt: now, lastError: null },
        });
        await scoped.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: 'succeeded',
            finishedAt: now,
            recordsProcessed: metricDays,
            error: null,
          },
        });

        return { syncRunId: syncRun.id, campaigns: campaigns.length, metricDays };
      } catch (error) {
        await scoped.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: errorMessage(error).slice(0, 500),
          },
        });
        await scoped.adAccount.update({
          where: { id: account.id },
          data: { status: 'needs_attention', lastError: errorMessage(error).slice(0, 500) },
        });
        throw error;
      }
    },
  );
}
