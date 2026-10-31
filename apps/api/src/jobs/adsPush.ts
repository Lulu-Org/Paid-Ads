import { scopedDb } from '../db/scoped';
import { runAs } from '../lib/actorContext';
import { AppError } from '../lib/errors';
import { getAdsProvider } from '../providers';
import { toProviderAccount } from '../providers/account';
import { toCampaignDto } from '../services/campaigns';
import type { AdsPushPayload } from './queues';

// Sends a local campaign change to the ad platform (docs/api.md "Background jobs"). A campaign is
// created remotely only while externalId is null; retries are safe because the simulated provider
// returns the same external id for the same campaign, and once stored it is never created again.

export interface AdsPushResult {
  syncRunId: string;
  externalId: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function processAdsPush(payload: AdsPushPayload): Promise<AdsPushResult> {
  return runAs(
    {
      actorType: 'user',
      actorId: payload.requestedById,
      workspaceId: payload.workspaceId,
      ...(payload.correlationId === undefined ? {} : { correlationId: payload.correlationId }),
    },
    async () => {
      const scoped = scopedDb(payload.workspaceId);
      const campaign = await scoped.campaign.findFirst({ where: { id: payload.campaignId } });
      if (campaign === null) throw AppError.notFound('NOT_FOUND');
      if (campaign.adAccountId === null) {
        throw new Error(`Campaign ${campaign.id} has no ad account to push to`);
      }
      const account = await scoped.adAccount.findFirst({ where: { id: campaign.adAccountId } });
      if (account === null) throw AppError.notFound('NOT_FOUND');
      if (account.status === 'disconnected') {
        throw new Error(`Ad account ${account.id} is disconnected`);
      }

      const syncRun = await scoped.syncRun.create({
        data: {
          workspaceId: payload.workspaceId,
          adAccountId: account.id,
          platform: account.platform,
          kind: 'push',
          scope: 'campaign_performance',
          status: 'running',
        },
      });

      try {
        const providerAccount = toProviderAccount(account);
        const provider = getAdsProvider(account.platform);

        let externalId = campaign.externalId;
        if (externalId === null) {
          const pushed = await provider.pushCampaign(providerAccount, toCampaignDto(campaign));
          externalId = pushed.externalId;
          await scoped.campaign.update({
            where: { id: campaign.id },
            data: { externalId },
          });
        }

        if (campaign.status === 'live' || campaign.status === 'paused') {
          await provider.setStatus(providerAccount, externalId, campaign.status);
        }
        await provider.setBudget(
          providerAccount,
          externalId,
          { amount: campaign.budgetAmount.toNumber(), currency: campaign.budgetCurrency },
          campaign.budgetPeriod,
        );

        const now = new Date();
        await scoped.syncRun.update({
          where: { id: syncRun.id },
          data: { status: 'succeeded', finishedAt: now, recordsProcessed: 1, error: null },
        });
        return { syncRunId: syncRun.id, externalId };
      } catch (error) {
        await scoped.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: errorMessage(error).slice(0, 500),
          },
        });
        throw error;
      }
    },
  );
}
