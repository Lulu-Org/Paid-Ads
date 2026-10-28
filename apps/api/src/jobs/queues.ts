import { Queue, type JobsOptions } from 'bullmq';
import { currentActor } from '../lib/actorContext';
import { createRedisConnection, disconnectRedis } from '../lib/redis';

// Provider work never runs inside a request (AGENTS.md rule 6): pulling metrics from an ad account
// and pushing a campaign change both go through these queues. See docs/api.md, "Background jobs".
export const QUEUE_NAMES = {
  ADS_SYNC: 'ads.sync',
  ADS_PUSH: 'ads.push',
} as const;

export interface AdsSyncPayload {
  workspaceId: string;
  adAccountId: string;
  correlationId?: string;
}

export interface AdsPushPayload {
  workspaceId: string;
  campaignId: string;
  requestedById: string;
  correlationId?: string;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export const adsSyncQueue = new Queue<AdsSyncPayload>(QUEUE_NAMES.ADS_SYNC, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const adsPushQueue = new Queue<AdsPushPayload>(QUEUE_NAMES.ADS_PUSH, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export async function enqueueAdsSync(payload: AdsSyncPayload) {
  return adsSyncQueue.add('sync', { correlationId: currentActor().correlationId, ...payload });
}

export async function enqueueAdsPush(payload: AdsPushPayload) {
  return adsPushQueue.add('push', { correlationId: currentActor().correlationId, ...payload });
}

export async function closeQueues(): Promise<void> {
  await Promise.all([adsSyncQueue.close(), adsPushQueue.close()]);
  await disconnectRedis();
}
