import {
  buildOverview,
  type CampaignMetricDay,
  type Overview,
  type OverviewQuery,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toAdAccountDto, toCampaignDto, toCampaignMetricDayDto } from './campaigns';

// GET /overview. Loads the workspace's campaigns, metric days and accounts, then hands the shared
// buildOverview the same shapes the web mock uses, so both compute the KPIs identically.

export async function getOverview(ctx: RequestContext, query: OverviewQuery): Promise<Overview> {
  const workspace = await db.workspace.findFirst({
    where: { id: ctx.workspaceId, deletedAt: null },
  });
  if (workspace === null) throw AppError.notFound('NOT_FOUND');

  const scoped = scopedDb(ctx.workspaceId);
  const [campaignRows, accountRows] = await Promise.all([
    scoped.campaign.findMany(),
    scoped.adAccount.findMany(),
  ]);

  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const dayRows =
    campaignIds.length === 0
      ? []
      : await scoped.campaignMetricDay.findMany({
          where: { campaignId: { in: campaignIds } },
          orderBy: { date: 'asc' },
        });

  const days: Record<string, CampaignMetricDay[]> = {};
  for (const row of dayRows) {
    const list = days[row.campaignId] ?? [];
    list.push(toCampaignMetricDayDto(row));
    days[row.campaignId] = list;
  }

  return buildOverview({
    campaigns: campaignRows.map(toCampaignDto),
    days,
    accounts: accountRows.map(toAdAccountDto),
    currency: workspace.defaultCurrency,
    rangeDays: query.rangeDays,
    today: new Date(),
  });
}
