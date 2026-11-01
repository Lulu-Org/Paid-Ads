import type { AdPlatform, BudgetPeriod, Campaign, CampaignStatus, Money } from '@lulu/shared';
import { customerId, type GoogleOAuthTokenResult } from './googleLsaClient';
import type {
  AdsProvider,
  ExchangeCodeResult,
  ExternalAccount,
  ExternalCampaign,
  ExternalMetricDay,
  ProviderAccount,
  PushCampaignResult,
} from './types';

// Live Google Local Services provider (C1). Standalone LOCAL_SERVICES campaigns and Local Services
// Performance Max campaigns are read through GAQL; spend and charged leads are reconciled per day.
// Google does not allow creating standalone Local Services campaigns through the API, so pushes only
// update existing campaigns (status and budget).

export const MONTHLY_DAYS = 30.4;

const LSA_CAMPAIGN_FILTER =
  "(campaign.advertising_channel_type = 'LOCAL_SERVICES' OR (campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND campaign.pmax_campaign_settings.local_services_enabled = true))";

export const CAMPAIGN_QUERY = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.start_date,
    campaign.end_date,
    campaign.advertising_channel_type,
    campaign_budget.amount_micros,
    campaign_budget.currency_code
  FROM campaign
  WHERE ${LSA_CAMPAIGN_FILTER}
`;

const CUSTOMER_QUERY = `
  SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager
  FROM customer
`;

const CAMPAIGN_BUDGET_QUERY = (externalId: string) => `
  SELECT campaign.id, campaign.campaign_budget
  FROM campaign
  WHERE campaign.id = ${externalId}
`;

interface GoogleCampaignRow {
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    advertisingChannelType?: string;
    campaignBudget?: string;
  };
  campaignBudget?: {
    amountMicros?: string | number;
    currencyCode?: string;
  };
}

interface GoogleMetricRow {
  campaign?: { id?: string | number };
  segments?: { date?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
  };
}

interface GoogleLeadRow {
  localServicesLead?: {
    campaign?: string;
    leadType?: string;
    creationDateTime?: string;
    leadCharged?: boolean;
  };
}

interface GoogleCustomerRow {
  customer?: {
    id?: string | number;
    descriptiveName?: string;
    currencyCode?: string;
    manager?: boolean;
  };
}

/** The subset of the REST client the provider uses, so tests can inject a fake. */
export interface GoogleLsaClient {
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<GoogleOAuthTokenResult>;
  listAccessibleCustomers(refreshToken: string): Promise<string[]>;
  search<T>(refreshToken: string, customerIdValue: string, query: string): Promise<T[]>;
  mutateCampaigns(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown>;
  mutateCampaignBudgets(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown>;
}

export interface GoogleLsaProviderOptions {
  client: GoogleLsaClient;
  apiPublicUrl: string;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (value === undefined || value.length === 0) return null;
  const date = new Date(`${value.slice(0, 10)}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value: string | undefined): Date | null {
  if (value === undefined || value.length === 0) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapStatus(status: string | undefined): CampaignStatus {
  switch (status) {
    case 'ENABLED':
      return 'live';
    case 'REMOVED':
      return 'ended';
    case 'PAUSED':
    default:
      return 'paused';
  }
}

function campaignIdFromResource(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  const id = value.split('/').filter(Boolean).at(-1);
  return id === undefined ? null : id;
}

/** Google's average daily budget to Lulu's monthly budget. */
export function dailyMicrosToMonthly(amountMicros: string | number | undefined): number {
  return roundMoney((toNumber(amountMicros) / 1_000_000) * MONTHLY_DAYS);
}

/** Lulu's monthly budget to Google's average daily budget, in micros. */
export function monthlyToDailyMicros(monthlyAmount: number): number {
  return Math.round((monthlyAmount / MONTHLY_DAYS) * 1_000_000);
}

export class GoogleLsaProvider implements AdsProvider {
  readonly platform: AdPlatform = 'google_lsa';

  private readonly client: GoogleLsaClient;
  private readonly apiPublicUrl: string;

  constructor(options: GoogleLsaProviderOptions) {
    this.client = options.client;
    this.apiPublicUrl = options.apiPublicUrl.replace(/\/$/, '');
  }

  private redirectUri(): string {
    return `${this.apiPublicUrl}/api/v1/ad-accounts/callback/google_lsa`;
  }

  authorizeUrl(state: string): string {
    return this.client.authorizeUrl(state, this.redirectUri());
  }

  async exchangeCode(code: string): Promise<ExchangeCodeResult> {
    const tokens = await this.client.exchangeCode(code, this.redirectUri());
    if (tokens.refreshToken === null) {
      throw new Error(
        'Google did not return a refresh token. Revoke Lulu in the Google account and connect again.',
      );
    }

    const accounts: ExternalAccount[] = [];
    const customerIds = await this.client.listAccessibleCustomers(tokens.refreshToken);
    for (const customerIdValue of customerIds) {
      const rows = await this.client.search<GoogleCustomerRow>(
        tokens.refreshToken,
        customerIdValue,
        CUSTOMER_QUERY,
      );
      const customer = rows[0]?.customer;
      if (customer?.manager === true) continue;

      const currency = customer?.currencyCode ?? 'EUR';
      const campaigns = await this.fetchCampaigns(tokens.refreshToken, customerIdValue, currency);
      // An account with no LSA campaign cannot be distinguished from an account without LSA
      // setup, so it is left out. Documented as a C1 limitation in docs/api.md.
      if (campaigns.length === 0) continue;

      accounts.push({
        externalId: customerIdValue,
        name: customer?.descriptiveName ?? `Google Ads ${customerIdValue}`,
        currency,
        scopes: tokens.scopes,
      });
    }

    return { token: tokens.refreshToken, expiresAt: null, accounts };
  }

  listCampaigns(account: ProviderAccount): Promise<ExternalCampaign[]> {
    return this.fetchCampaigns(account.token, account.externalId, account.currency);
  }

  async metrics(account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]> {
    const first = startOfUtcDay(from);
    const last = startOfUtcDay(to);
    const fromDay = isoDay(first);
    const toDay = isoDay(last);
    const nextDay = isoDay(new Date(last.getTime() + 86_400_000));

    const metricQuery = `
      SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM campaign
      WHERE ${LSA_CAMPAIGN_FILTER}
        AND segments.date BETWEEN '${fromDay}' AND '${toDay}'
    `;
    const leadQuery = `
      SELECT
        local_services_lead.campaign,
        local_services_lead.lead_type,
        local_services_lead.creation_date_time,
        local_services_lead.lead_charged
      FROM local_services_lead
      WHERE local_services_lead.lead_charged = true
        AND local_services_lead.creation_date_time >= '${fromDay} 00:00:00'
        AND local_services_lead.creation_date_time < '${nextDay} 00:00:00'
    `;

    const [metricRows, leadRows] = await Promise.all([
      this.client.search<GoogleMetricRow>(account.token, account.externalId, metricQuery),
      this.client.search<GoogleLeadRow>(account.token, account.externalId, leadQuery),
    ]);

    const days = new Map<string, ExternalMetricDay>();
    const dayFor = (externalId: string, date: Date): ExternalMetricDay => {
      const key = `${externalId}:${isoDay(date)}`;
      const existing = days.get(key);
      if (existing !== undefined) return existing;
      const created: ExternalMetricDay = {
        externalId,
        date,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        leads: 0,
        calls: 0,
        spend: { amount: 0, currency: account.currency },
        revenue: { amount: 0, currency: account.currency },
      };
      days.set(key, created);
      return created;
    };

    for (const row of metricRows) {
      const externalId = row.campaign?.id === undefined ? null : String(row.campaign.id);
      const date = parseDate(row.segments?.date);
      if (externalId === null || date === null) continue;
      const day = dayFor(externalId, date);
      day.impressions += toNumber(row.metrics?.impressions);
      day.clicks += toNumber(row.metrics?.clicks);
      day.spend.amount = roundMoney(
        day.spend.amount + toNumber(row.metrics?.costMicros) / 1_000_000,
      );
    }

    for (const row of leadRows) {
      const lead = row.localServicesLead;
      if (lead?.leadCharged !== true) continue;
      const externalId = campaignIdFromResource(lead.campaign);
      const date = parseDateTime(lead.creationDateTime);
      if (externalId === null || date === null) continue;
      const day = dayFor(externalId, startOfUtcDay(date));
      day.leads += 1;
      day.conversions += 1;
      if (lead.leadType === 'PHONE_CALL') day.calls += 1;
    }

    return [...days.values()].sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.externalId.localeCompare(b.externalId),
    );
  }

  async setStatus(
    account: ProviderAccount,
    externalId: string,
    status: 'live' | 'paused',
  ): Promise<void> {
    const resourceName = `customers/${customerId(account.externalId)}/campaigns/${externalId}`;
    await this.client.mutateCampaigns(account.token, account.externalId, [
      {
        update: { resourceName, status: status === 'live' ? 'ENABLED' : 'PAUSED' },
        updateMask: 'status',
      },
    ]);
  }

  async setBudget(
    account: ProviderAccount,
    externalId: string,
    budget: Money,
    budgetPeriod: BudgetPeriod,
  ): Promise<void> {
    // Google holds an average daily budget; a total for the whole run has no equivalent.
    if (budgetPeriod === 'total') {
      throw new Error(
        'Google Local Services budgets are monthly or daily, not a total for the whole campaign',
      );
    }
    if (budget.currency !== account.currency) {
      throw new Error(
        `Budget currency ${budget.currency} does not match the Google Ads account currency ${account.currency}`,
      );
    }
    const rows = await this.client.search<GoogleCampaignRow>(
      account.token,
      account.externalId,
      CAMPAIGN_BUDGET_QUERY(externalId),
    );
    const budgetResource = rows[0]?.campaign?.campaignBudget;
    if (budgetResource === undefined) {
      throw new Error(`Google Ads campaign ${externalId} has no campaign budget`);
    }
    await this.client.mutateCampaignBudgets(account.token, account.externalId, [
      {
        update: {
          resourceName: budgetResource,
          amountMicros: String(
            budgetPeriod === 'daily'
              ? Math.round(budget.amount * 1_000_000)
              : monthlyToDailyMicros(budget.amount),
          ),
        },
        updateMask: 'amount_micros',
      },
    ]);
  }

  pushCampaign(_account: ProviderAccount, _campaign: Campaign): Promise<PushCampaignResult> {
    return Promise.reject(
      new Error(
        'Creating Google Local Services campaigns is not supported by the Google Ads API. Create the campaign in Google Ads, then sync it into Lulu.',
      ),
    );
  }

  private async fetchCampaigns(
    refreshToken: string,
    customerIdValue: string,
    fallbackCurrency: string,
  ): Promise<ExternalCampaign[]> {
    const rows = await this.client.search<GoogleCampaignRow>(
      refreshToken,
      customerIdValue,
      CAMPAIGN_QUERY,
    );
    const campaigns: ExternalCampaign[] = [];
    for (const row of rows) {
      const campaign = row.campaign;
      if (campaign?.id === undefined) continue;
      const currency = row.campaignBudget?.currencyCode ?? fallbackCurrency;
      campaigns.push({
        externalId: String(campaign.id),
        name: campaign.name ?? `Google Ads campaign ${campaign.id}`,
        status: mapStatus(campaign.status),
        objective: 'Local Services leads',
        audienceSummary: null,
        startAt: parseDate(campaign.startDate),
        endAt: parseDate(campaign.endDate, true),
        budget: {
          amount: dailyMicrosToMonthly(row.campaignBudget?.amountMicros),
          currency,
        },
        budgetPeriod: 'monthly',
      });
    }
    return campaigns;
  }
}
