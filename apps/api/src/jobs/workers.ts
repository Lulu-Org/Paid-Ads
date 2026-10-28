import type { Worker } from 'bullmq';
import { startOutboxDispatcher, stopOutboxDispatcher } from './outbox';

let workers: Worker[] = [];

// The ads.sync and ads.push workers are added with the provider connectors (tasks P3–P6).
export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;
  // Domain events written next to every change (db/audit.ts) are published from here.
  startOutboxDispatcher();
  return workers;
}

export async function stopWorkers(): Promise<void> {
  stopOutboxDispatcher();
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
}
