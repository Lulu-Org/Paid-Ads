import { adPlatformSchema, type AdPlatform, type AdAccount, type SyncRun } from '@lulu/shared';
import { env } from '../config/env';
import { scopedDb } from '../db/scoped';
import type {
  AdAccount as AdAccountRow,
  Prisma,
  SyncRun as SyncRunRow,
} from '../generated/prisma/client';
import { enqueueAdsSync } from '../jobs/queues';
import { removeAccountSync, scheduleAccountSync } from '../jobs/schedulers';
import { AppError } from '../lib/errors';
import { signOAuthState, verifyOAuthState } from '../lib/oauthState';
import { encryptToken } from '../lib/tokenCrypto';
import type { RequestContext } from '../middleware/requestContext';
import { getAdsProvider } from '../providers';
import { toAdAccountDto } from './campaigns';

// Ad-account connections (docs/api.md "Ad accounts and providers"). Tokens are encrypted before
// they reach the database and never leave the API; the callback is public but requires a signed,
// single-use state.

const iso = (value: Date) => value.toISOString();

export function toSyncRunDto(row: SyncRunRow): SyncRun {
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

async function findAccount(workspaceId: string, id: string): Promise<AdAccountRow> {
  const row = await scopedDb(workspaceId).adAccount.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

export async function listAdAccounts(ctx: RequestContext): Promise<AdAccount[]> {
  const rows = await scopedDb(ctx.workspaceId).adAccount.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toAdAccountDto);
}

export async function startConnect(
  ctx: RequestContext,
  platform: AdPlatform,
): Promise<{ authorizeUrl: string }> {
  const provider = getAdsProvider(platform);
  const state = await signOAuthState({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    platform,
  });
  return { authorizeUrl: provider.authorizeUrl(state) };
}

export interface CallbackResult {
  redirectUrl: string;
  adAccountIds: string[];
}

export async function completeCallback(
  platform: AdPlatform,
  code: string,
  state: string,
): Promise<CallbackResult> {
  const parsedPlatform = adPlatformSchema.parse(platform);
  const claims = await verifyOAuthState(state);
  if (claims.platform !== parsedPlatform) {
    throw AppError.unauthorized();
  }

  const provider = getAdsProvider(parsedPlatform);
  const exchanged = await provider.exchangeCode(code);
  const scoped = scopedDb(claims.workspaceId);
  const adAccountIds: string[] = [];

  for (const external of exchanged.accounts) {
    const existing = await scoped.adAccount.findFirst({
      where: { platform: parsedPlatform, externalId: external.externalId },
    });
    const data: Prisma.AdAccountUncheckedCreateInput = {
      workspaceId: claims.workspaceId,
      platform: parsedPlatform,
      externalId: external.externalId,
      name: external.name,
      currency: external.currency,
      status: 'connected',
      scopes: external.scopes,
      tokenEncrypted: encryptToken(exchanged.token),
      tokenExpiresAt: exchanged.expiresAt,
      lastError: null,
    };
    const account =
      existing === null
        ? await scoped.adAccount.create({ data })
        : await scoped.adAccount.update({ where: { id: existing.id }, data });

    adAccountIds.push(account.id);

    const syncRun = await scoped.syncRun.create({
      data: {
        workspaceId: claims.workspaceId,
        adAccountId: account.id,
        platform: parsedPlatform,
        kind: 'sync',
        scope: 'campaign_performance',
        status: 'queued',
      },
    });
    await enqueueAdsSync({
      workspaceId: claims.workspaceId,
      adAccountId: account.id,
      syncRunId: syncRun.id,
    });
    await scheduleAccountSync(account);
  }

  return {
    redirectUrl: `${env.CORS_ORIGIN.replace(/\/$/, '')}/ads/integrations?connected=${parsedPlatform}`,
    adAccountIds,
  };
}

export async function queueSync(ctx: RequestContext, adAccountId: string): Promise<SyncRun> {
  const account = await findAccount(ctx.workspaceId, adAccountId);
  if (account.status === 'disconnected') {
    throw AppError.conflict('CONFLICT', { status: account.status });
  }

  const syncRun = await scopedDb(ctx.workspaceId).syncRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      adAccountId: account.id,
      platform: account.platform,
      kind: 'sync',
      scope: 'campaign_performance',
      status: 'queued',
    },
  });
  await enqueueAdsSync({
    workspaceId: ctx.workspaceId,
    adAccountId: account.id,
    syncRunId: syncRun.id,
  });
  return toSyncRunDto(syncRun);
}

export async function disconnect(ctx: RequestContext, adAccountId: string): Promise<void> {
  await findAccount(ctx.workspaceId, adAccountId);
  await scopedDb(ctx.workspaceId).adAccount.update({
    where: { id: adAccountId },
    data: {
      status: 'disconnected',
      tokenEncrypted: null,
      tokenExpiresAt: null,
      scopes: [],
      lastError: null,
    },
  });
  await removeAccountSync(adAccountId);
}
