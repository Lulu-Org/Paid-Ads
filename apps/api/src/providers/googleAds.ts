import type { AdPlatform, BudgetPeriod, Campaign, Money } from '@lulu/shared';
import {
  dailyMicrosToMonthly,
  isoDay,
  mapStatus,
  monthlyToDailyMicros,
  parseDate,
  roundMoney,
  startOfUtcDay,
  toNumber,
  type GoogleAdsApiClient,
} from './googleAdsCommon';
import { customerId } from './googleLsaClient';
import type {
  AdsProvider,
  ExchangeCodeResult,
  ExternalAccount,
  ExternalCampaign,
  ExternalMetricDay,
  ProviderAccount,
  PushCampaignResult,
} from './types';

// Live Google Ads provider (C2, docs/api.md "Google Ads (live, C2)"). Search, Display and YouTube
// campaigns are synced through GAQL, with daily metrics, pause/resume and budget changes. Lulu does
// not model ad groups, ads, keywords or targeting, so campaigns are created in Google Ads and synced
// in; launching a live draft without an external id is blocked by campaignCreationSupported.

const CHANNEL_OBJECTIVE: Record<string, string> = {
  SEARCH: 'Search',
  DISPLAY: 'Display',
  VIDEO: 'YouTube',
};

export const GOOGLE_ADS_CAMPAIGN_FILTER =
  "campaign.advertising_channel_type IN ('SEARCH', 'DISPLAY', 'VIDEO')";

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
  WHERE ${GOOGLE_ADS_CAMPAIGN_FILTER}
`;

const CUSTOMER_QUERY = `
  SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager
  FROM customer
`;

const CAMPAIGN_BUDGET_QUERY = (externalId: string) => `
  SELECT campaign.id, campaign.campaign_budget, campaign_budget.explicitly_shared
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
    explicitlyShared?: boolean;
  };
}

interface GoogleMetricRow {
  campaign?: { id?: string | number };
  segments?: { date?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
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

export interface GoogleAdsProviderOptions {
  client: GoogleAdsApiClient;
  apiPublicUrl: string;
}

export class GoogleAdsProvider implements AdsProvider {
  readonly platform: AdPlatform = 'google_ads';

  private readonly client: GoogleAdsApiClient;
  private readonly apiPublicUrl: string;

  constructor(options: GoogleAdsProviderOptions) {
    this.client = options.client;
    this.apiPublicUrl = options.apiPublicUrl.replace(/\/$/, '');
  }

  private redirectUri(): string {
    return `${this.apiPublicUrl}/api/v1/ad-accounts/callback/google_ads`;
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
      // An account with no Search, Display or YouTube campaign cannot be distinguished from an
      // account without Google Ads setup, so it is left out (documented as a C2 limitation).
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

    const query = `
      SELECT
        campaign.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${GOOGLE_ADS_CAMPAIGN_FILTER}
        AND segments.date BETWEEN '${fromDay}' AND '${toDay}'
    `;
    const rows = await this.client.search<GoogleMetricRow>(
      account.token,
      account.externalId,
      query,
    );

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

    for (const row of rows) {
      const externalId = row.campaign?.id === undefined ? null : String(row.campaign.id);
      const date = parseDate(row.segments?.date);
      if (externalId === null || date === null) continue;
      const day = dayFor(externalId, date);
      day.impressions += toNumber(row.metrics?.impressions);
      day.clicks += toNumber(row.metrics?.clicks);
      day.spend.amount = roundMoney(
        day.spend.amount + toNumber(row.metrics?.costMicros) / 1_000_000,
      );
      // Google Ads reports conversions as a fractional number; Lulu stores whole conversions.
      const conversions = Math.round(toNumber(row.metrics?.conversions));
      day.conversions += conversions;
      day.leads += conversions;
      // Google Ads has no charged phone calls, so calls stays zero.
      day.revenue.amount = roundMoney(day.revenue.amount + toNumber(row.metrics?.conversionsValue));
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
        'Google Ads budgets are monthly or daily, not a total for the whole campaign',
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
    // A shared budget funds other campaigns too, so changing it here would raise or cut their
    // spend without anyone approving that. Leave it to Google Ads.
    if (rows[0]?.campaignBudget?.explicitlyShared === true) {
      throw new Error(
        `Google Ads campaign ${externalId} uses a shared budget; change it in Google Ads so every campaign on it is reviewed`,
      );
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
        'Creating Google Ads campaigns is not supported. Create the campaign in Google Ads, then sync it into Lulu.',
      ),
    );
  }

  private async fetchCampaigns(
    refreshToken: string,
    customerIdValue: string,
    accountCurrency: string,
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
      const objective =
        campaign.advertisingChannelType === undefined
          ? undefined
          : CHANNEL_OBJECTIVE[campaign.advertisingChannelType];
      if (objective === undefined) continue;
      campaigns.push({
        externalId: String(campaign.id),
        name: campaign.name ?? `Google Ads campaign ${campaign.id}`,
        status: mapStatus(campaign.status),
        objective,
        audienceSummary: null,
        startAt: parseDate(campaign.startDate),
        endAt: parseDate(campaign.endDate, true),
        budget: {
          amount: dailyMicrosToMonthly(row.campaignBudget?.amountMicros),
          // The account currency, not campaign_budget.currency_code, drives the stored budget.
          currency: accountCurrency,
        },
        budgetPeriod: 'monthly',
      });
    }
    return campaigns;
  }
}
