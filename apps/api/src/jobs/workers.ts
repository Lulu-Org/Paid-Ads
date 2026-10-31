import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { assertProviderConfiguration } from '../providers';
import { processAdsPush } from './adsPush';
import { processAdsSync } from './adsSync';
import { startOutboxDispatcher, stopOutboxDispatcher } from './outbox';
import { QUEUE_NAMES, type AdsPushPayload, type AdsSyncPayload } from './queues';
import { reconcileAdsSyncSchedulers } from './schedulers';

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;
  // A live provider without an implementation must stop the process, not silently use sample data.
  assertProviderConfiguration();

  // Domain events written next to every change (db/audit.ts) are published from here.
  startOutboxDispatcher();

  // Provider syncs run one at a time so a workspace never gets concurrent duplicate writes.
  const syncWorker = new Worker<AdsSyncPayload>(
    QUEUE_NAMES.ADS_SYNC,
    async (job) => processAdsSync(job.data),
    { connection: createRedisConnection(), concurrency: 1 },
  );
  const pushWorker = new Worker<AdsPushPayload>(
    QUEUE_NAMES.ADS_PUSH,
    async (job) => processAdsPush(job.data),
    { connection: createRedisConnection(), concurrency: 1 },
  );

  for (const worker of [syncWorker, pushWorker]) {
    worker.on('failed', (job, error: Error) => {
      console.error(`[${worker.name}] job ${job?.id ?? '?'} failed: ${error.message}`);
    });
  }
  workers = [syncWorker, pushWorker];

  // Job schedulers survive restarts; make Redis match the connected accounts in the database.
  void reconcileAdsSyncSchedulers().catch((error: unknown) =>
    console.error(
      `[ads.sync] scheduler reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );

  return workers;
}

export async function stopWorkers(): Promise<void> {
  stopOutboxDispatcher();
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
}
