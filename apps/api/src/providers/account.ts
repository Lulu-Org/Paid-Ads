import type { AdAccount as AdAccountRow } from '../generated/prisma/client';
import { decryptToken } from '../lib/tokenCrypto';
import type { ProviderAccount } from './types';

/** Decrypts an account's stored token for a provider call. Never log or serialize the result. */
export function toProviderAccount(row: AdAccountRow): ProviderAccount {
  if (row.tokenEncrypted === null) {
    throw new Error(`Ad account ${row.id} has no stored token`);
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    platform: row.platform,
    externalId: row.externalId,
    name: row.name,
    currency: row.currency,
    scopes: row.scopes,
    token: decryptToken(row.tokenEncrypted),
    tokenExpiresAt: row.tokenExpiresAt,
  };
}
