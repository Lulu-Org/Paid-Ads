import type { AdPlatform, Campaign, CampaignStatus, Money } from '@lulu/shared';

// The boundary between Lulu and an ad platform (docs/api.md "Ad accounts and providers"). Live
// connectors implement this; the simulated provider answers until developer access arrives, so the
// API, workers and tests never depend on a vendor SDK.

export interface ExternalAccount {
  externalId: string;
  name: string;
  currency: string;
  scopes: string[];
}

export interface ExchangeCodeResult {
  token: string;
  expiresAt: Date | null;
  accounts: ExternalAccount[];
}

export interface ExternalCampaign {
  externalId: string;
  name: string;
  status: CampaignStatus;
  objective: string;
  audienceSummary: string | null;
  startAt: Date | null;
  endAt: Date | null;
  budget: Money;
}

export interface ExternalMetricDay {
  // The campaign's platform id.
  externalId: string;
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  spend: Money;
  revenue: Money;
}

// Account metadata plus the decrypted token. Only the provider layer sees the token; it is never
// logged, serialized or returned by the API.
export interface ProviderAccount {
  id: string;
  workspaceId: string;
  platform: AdPlatform;
  externalId: string;
  name: string;
  currency: string;
  scopes: string[];
  token: string;
  tokenExpiresAt: Date | null;
}

export interface PushCampaignResult {
  externalId: string;
}

export interface AdsProvider {
  platform: AdPlatform;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangeCodeResult>;
  listCampaigns(account: ProviderAccount): Promise<ExternalCampaign[]>;
  metrics(account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]>;
  pushCampaign(account: ProviderAccount, campaign: Campaign): Promise<PushCampaignResult>;
  setStatus(account: ProviderAccount, externalId: string, status: 'live' | 'paused'): Promise<void>;
  setBudget(account: ProviderAccount, externalId: string, budget: Money): Promise<void>;
}
