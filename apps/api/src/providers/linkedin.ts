import type { BudgetPeriod, Campaign, CampaignStatus, Money } from '@lulu/shared';
import type {
  AdsProvider,
  ExchangeCodeResult,
  ExternalAccount,
  ExternalCampaign,
  ExternalMetricDay,
  ProviderAccount,
  PushCampaignResult,
} from './types';

// LinkedIn Marketing API connector (task C4, docs/api.md "Ad accounts and providers").
// Versioned REST API: every call sends LinkedIn-Version (YYYYMM) and the Rest.li 2.0 protocol header.
// What it does: sign-in, ad accounts, campaigns, daily analytics, pause/resume and the total budget.
// What it does not do: create campaigns. LinkedIn needs a campaign group, targeting and creatives
// that Lulu does not model yet, so that is an explicit manual step (catalog PA-40-06), never a fake.

export const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_API_URL = 'https://api.linkedin.com/rest';
// Read ad accounts and reporting, and manage campaigns.
export const LINKEDIN_SCOPES = ['r_ads', 'r_ads_reporting', 'rw_ads'];

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  // https://<api>/api/v1/ad-accounts/callback/linkedin_ads, registered in the LinkedIn app.
  redirectUri: string;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** A failed LinkedIn call. `retryable` is true for rate limits and server errors (the job retries). */
export class LinkedInApiError extends Error {
  constructor(
    readonly status: number,
    readonly serviceErrorCode: number | null,
    message: string,
  ) {
    super(`LinkedIn API ${status}: ${message}`);
    this.name = 'LinkedInApiError';
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** An operation LinkedIn's API (or our model of it) cannot do; shown as a manual step, never faked. */
export class ProviderOperationUnsupportedError extends Error {
  constructor(operation: string) {
    super(
      `LinkedIn: ${operation} is not supported through the API yet; do it in LinkedIn Campaign Manager`,
    );
    this.name = 'ProviderOperationUnsupportedError';
  }
}

// ---------- LinkedIn shapes (only the fields we read) ----------

interface LiMoney {
  amount: string;
  currencyCode: string;
}

interface LiAccount {
  id: number;
  name: string;
  currency: string;
  status: string;
}

interface LiCampaign {
  id: number;
  name: string;
  status: string;
  objectiveType?: string;
  runSchedule?: { start?: number; end?: number };
  totalBudget?: LiMoney;
  dailyBudget?: LiMoney;
}

interface LiDate {
  year: number;
  month: number;
  day: number;
}

interface LiAnalyticsRow {
  pivotValues?: string[];
  dateRange?: { start: LiDate };
  impressions?: number;
  clicks?: number;
  costInLocalCurrency?: string;
  externalWebsiteConversions?: number;
  oneClickLeads?: number;
  conversionValueInLocalCurrency?: string;
}

interface LiPage<T> {
  elements: T[];
  metadata?: { nextPageToken?: string };
}

// ---------- Mapping ----------

// Removed and pending-deletion campaigns are left out; finished ones become "ended".
const STATUS: Record<string, CampaignStatus | null> = {
  ACTIVE: 'live',
  PAUSED: 'paused',
  DRAFT: 'draft',
  COMPLETED: 'ended',
  ARCHIVED: 'ended',
  CANCELED: 'ended',
  PENDING_DELETION: null,
  REMOVED: null,
};

const decimal = (value: string | undefined) => (value === undefined ? 0 : Number(value));
const toUtcDate = (d: LiDate) => new Date(Date.UTC(d.year, d.month - 1, d.day));
const campaignIdFromUrn = (urn: string) => urn.slice(urn.lastIndexOf(':') + 1);
const restliDate = (d: Date) =>
  `(year:${d.getUTCFullYear()},month:${d.getUTCMonth() + 1},day:${d.getUTCDate()})`;

export function mapLinkedInCampaign(
  campaign: LiCampaign,
  accountCurrency: string,
): ExternalCampaign | null {
  const status = STATUS[campaign.status];
  if (status === undefined || status === null) return null;
  // A lifetime budget is a total; a campaign with only a daily budget keeps it as daily.
  const budget = campaign.totalBudget ?? campaign.dailyBudget;
  const budgetPeriod =
    campaign.totalBudget === undefined && campaign.dailyBudget !== undefined ? 'daily' : 'total';
  return {
    externalId: String(campaign.id),
    name: campaign.name,
    status,
    objective: campaign.objectiveType ?? 'UNKNOWN',
    audienceSummary: null,
    startAt: campaign.runSchedule?.start ? new Date(campaign.runSchedule.start) : null,
    endAt: campaign.runSchedule?.end ? new Date(campaign.runSchedule.end) : null,
    budget: budget
      ? { amount: decimal(budget.amount), currency: budget.currencyCode }
      : { amount: 0, currency: accountCurrency },
    budgetPeriod,
  };
}

export function mapLinkedInAnalytics(
  row: LiAnalyticsRow,
  currency: string,
): ExternalMetricDay | null {
  const urn = row.pivotValues?.[0];
  if (!urn || !row.dateRange) return null;
  const leads = row.oneClickLeads ?? 0;
  return {
    externalId: campaignIdFromUrn(urn),
    date: toUtcDate(row.dateRange.start),
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    conversions: (row.externalWebsiteConversions ?? 0) + leads,
    leads,
    // LinkedIn has no charged phone calls.
    calls: 0,
    spend: { amount: decimal(row.costInLocalCurrency), currency },
    revenue: { amount: decimal(row.conversionValueInLocalCurrency), currency },
  };
}

// ---------- Provider ----------

export function createLinkedInProvider(
  config: LinkedInConfig,
  fetchFn: FetchLike = fetch,
): AdsProvider {
  const headers = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': config.apiVersion,
    'X-Restli-Protocol-Version': '2.0.0',
  });

  async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchFn(`${LINKEDIN_API_URL}${path}`, {
      ...init,
      headers: { ...headers(token), ...(init.headers as Record<string, string> | undefined) },
    });
    if (!response.ok) throw await apiError(response);
    // Partial updates answer 204 with no body.
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Follows nextPageToken until the last page (bounded, so a bad cursor cannot loop forever). */
  async function allPages<T>(token: string, path: string): Promise<T[]> {
    const rows: T[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const url = `${path}${sep}pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const result = await call<LiPage<T>>(token, url);
      rows.push(...result.elements);
      pageToken = result.metadata?.nextPageToken;
      if (!pageToken) return rows;
    }
    return rows;
  }

  async function partialUpdate(
    account: ProviderAccount,
    externalId: string,
    set: Record<string, unknown>,
  ) {
    await call<void>(account.token, `/adAccounts/${account.externalId}/adCampaigns/${externalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RestLi-Method': 'PARTIAL_UPDATE' },
      body: JSON.stringify({ patch: { $set: set } }),
    });
  }

  return {
    platform: 'linkedin_ads',

    authorizeUrl(state: string): string {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        state,
        scope: LINKEDIN_SCOPES.join(' '),
      });
      return `${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`;
    },

    async exchangeCode(code: string): Promise<ExchangeCodeResult> {
      const response = await fetchFn(LINKEDIN_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });
      if (!response.ok) throw await apiError(response);
      const tokenResult = (await response.json()) as {
        access_token: string;
        expires_in?: number;
        scope?: string;
      };
      const token = tokenResult.access_token;
      const scopes = tokenResult.scope
        ? tokenResult.scope.split(/[ ,]+/).filter(Boolean)
        : LINKEDIN_SCOPES;

      const accounts = await allPages<LiAccount>(
        token,
        '/adAccounts?q=search&search=(status:(values:List(ACTIVE)))',
      );
      return {
        token,
        expiresAt: tokenResult.expires_in
          ? new Date(Date.now() + tokenResult.expires_in * 1000)
          : null,
        accounts: accounts.map((a): ExternalAccount => ({
          externalId: String(a.id),
          name: a.name,
          currency: a.currency,
          scopes,
        })),
      };
    },

    async listCampaigns(account: ProviderAccount): Promise<ExternalCampaign[]> {
      const campaigns = await allPages<LiCampaign>(
        account.token,
        `/adAccounts/${account.externalId}/adCampaigns?q=search`,
      );
      return campaigns
        .map((c) => mapLinkedInCampaign(c, account.currency))
        .filter((c): c is ExternalCampaign => c !== null);
    },

    async metrics(account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]> {
      const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${account.externalId}`);
      const fields = [
        'impressions',
        'clicks',
        'costInLocalCurrency',
        'externalWebsiteConversions',
        'oneClickLeads',
        'conversionValueInLocalCurrency',
        'dateRange',
        'pivotValues',
      ].join(',');
      // Rest.li syntax: parentheses and colons stay literal, only the URN is encoded.
      const path =
        `/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY` +
        `&dateRange=(start:${restliDate(from)},end:${restliDate(to)})` +
        `&accounts=List(${accountUrn})&fields=${fields}`;
      const result = await call<LiPage<LiAnalyticsRow>>(account.token, path);
      return result.elements
        .map((row) => mapLinkedInAnalytics(row, account.currency))
        .filter((m): m is ExternalMetricDay => m !== null);
    },

    pushCampaign(_account: ProviderAccount, _campaign: Campaign): Promise<PushCampaignResult> {
      return Promise.reject(new ProviderOperationUnsupportedError('creating a campaign'));
    },

    async setStatus(
      account: ProviderAccount,
      externalId: string,
      status: 'live' | 'paused',
    ): Promise<void> {
      await partialUpdate(account, externalId, { status: status === 'live' ? 'ACTIVE' : 'PAUSED' });
    },

    async setBudget(
      account: ProviderAccount,
      externalId: string,
      budget: Money,
      budgetPeriod: BudgetPeriod,
    ): Promise<void> {
      // LinkedIn holds a lifetime or a daily budget; a monthly amount has no equivalent.
      if (budgetPeriod === 'monthly') {
        throw new Error('LinkedIn: budgets are a total for the campaign or daily, not monthly');
      }
      // A currency label error must never multiply spending authority (catalog PA-57-03).
      if (budget.currency !== account.currency) {
        throw new Error(
          `LinkedIn: budget currency ${budget.currency} does not match account currency ${account.currency}`,
        );
      }
      const amount = { amount: budget.amount.toFixed(2), currencyCode: budget.currency };
      await partialUpdate(
        account,
        externalId,
        budgetPeriod === 'total' ? { totalBudget: amount } : { dailyBudget: amount },
      );
    },
  };
}

async function apiError(response: Response): Promise<LinkedInApiError> {
  let serviceErrorCode: number | null = null;
  let message = response.statusText || 'request failed';
  try {
    const body = (await response.json()) as {
      serviceErrorCode?: number;
      message?: string;
      error_description?: string;
    };
    serviceErrorCode = body.serviceErrorCode ?? null;
    message = body.message ?? body.error_description ?? message;
  } catch {
    // Not JSON; keep the status text.
  }
  return new LinkedInApiError(response.status, serviceErrorCode, message);
}
