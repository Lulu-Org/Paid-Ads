import { db } from '../db/prisma';
import { adsSyncQueue, type AdsSyncPayload } from './queues';

// Each connected ad account syncs every six hours. BullMQ job schedulers survive restarts, so
// workers.ts reconciles them on startup: add one per connected account and remove stale ones.

export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const ACCOUNT_SCHEDULER_PREFIX = 'ad-account:';

export const accountSchedulerId = (adAccountId: string) =>
  `${ACCOUNT_SCHEDULER_PREFIX}${adAccountId}`;

interface SyncAccount {
  id: string;
  workspaceId: string;
}

export async function scheduleAccountSync(account: SyncAccount): Promise<void> {
  const data: AdsSyncPayload = {
    workspaceId: account.workspaceId,
    adAccountId: account.id,
  };
  await adsSyncQueue.upsertJobScheduler(
    accountSchedulerId(account.id),
    { every: SYNC_INTERVAL_MS },
    { name: 'sync', data },
  );
}

export async function removeAccountSync(adAccountId: string): Promise<void> {
  await adsSyncQueue.removeJobScheduler(accountSchedulerId(adAccountId));
}

/** Adds schedulers for every connected account and removes ones for accounts that are gone. */
export async function reconcileAdsSyncSchedulers(): Promise<void> {
  const accounts = await db.adAccount.findMany({
    where: { status: 'connected', deletedAt: null },
    select: { id: true, workspaceId: true },
  });
  const connected = new Set(accounts.map((account) => account.id));

  for (const account of accounts) {
    await scheduleAccountSync(account);
  }

  const schedulers = await adsSyncQueue.getJobSchedulers(0, -1, true);
  for (const scheduler of schedulers) {
    if (!scheduler.key.startsWith(ACCOUNT_SCHEDULER_PREFIX)) continue;
    const accountId = scheduler.key.slice(ACCOUNT_SCHEDULER_PREFIX.length);
    if (!connected.has(accountId)) {
      await removeAccountSync(accountId);
    }
  }
}
