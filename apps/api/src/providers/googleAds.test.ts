import { describe, expect, it } from 'vitest';
import type { GoogleAdsApiClient } from './googleAdsCommon';
import { GoogleAdsProvider } from './googleAds';
import type { GoogleOAuthTokenResult } from './googleLsaClient';
import type { ProviderAccount } from './types';

interface CampaignRow {
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    advertisingChannelType?: string;
    campaignBudget?: string;
  };
  campaignBudget?: { amountMicros?: string | number; currencyCode?: string };
}

interface CustomerRow {
  customer?: {
    id?: string | number;
    descriptiveName?: string;
    currencyCode?: string;
    manager?: boolean;
  };
}

class FakeClient implements GoogleAdsApiClient {
  tokens: GoogleOAuthTokenResult = {
    refreshToken: 'refresh-1',
    accessToken: 'access-1',
    expiresAt: new Date('2026-10-31T13:00:00.000Z'),
    scopes: ['https://www.googleapis.com/auth/adwords'],
  };
  accessible: string[] = ['111', '222', '333'];
  customers = new Map<string, CustomerRow>([
    ['111', { customer: { id: 111, descriptiveName: 'Manager', manager: true } }],
    ['222', { customer: { id: 222, descriptiveName: 'Lulu Berlin Ads', currencyCode: 'EUR' } }],
    [
      '333',
      { customer: { id: 333, descriptiveName: 'No eligible campaigns', currencyCode: 'EUR' } },
    ],
  ]);
  campaigns = new Map<string, CampaignRow[]>([
    [
      '222',
      [
        {
          campaign: {
            id: 1001,
            name: 'Search leads',
            status: 'ENABLED',
            startDate: '2026-06-01',
            advertisingChannelType: 'SEARCH',
          },
          campaignBudget: { amountMicros: '100000000', currencyCode: 'EUR' },
        },
      ],
    ],
  ]);
  metricRows: unknown[] = [];
  budgetResource = 'customers/222/campaignBudgets/9001';
  budgetShared = false;
  campaignMutations: unknown[] = [];
  budgetMutations: unknown[] = [];
  lastAuthorize: { state: string; redirectUri: string } | null = null;

  authorizeUrl(state: string, redirectUri: string): string {
    this.lastAuthorize = { state, redirectUri };
    return `https://accounts.google.com/consent?state=${encodeURIComponent(state)}`;
  }

  exchangeCode(_code: string, _redirectUri: string): Promise<GoogleOAuthTokenResult> {
    return Promise.resolve(this.tokens);
  }

  listAccessibleCustomers(): Promise<string[]> {
    return Promise.resolve(this.accessible);
  }

  search<T>(_refreshToken: string, customerIdValue: string, query: string): Promise<T[]> {
    if (query.includes('FROM customer')) {
      const row = this.customers.get(customerIdValue);
      return Promise.resolve((row === undefined ? [] : [row]) as T[]);
    }
    if (query.includes('campaign.campaign_budget')) {
      return Promise.resolve([
        {
          campaign: { id: 1001, campaignBudget: this.budgetResource },
          campaignBudget: { explicitlyShared: this.budgetShared },
        },
      ] as T[]);
    }
    if (query.includes('metrics.impressions')) {
      return Promise.resolve(this.metricRows as T[]);
    }
    return Promise.resolve((this.campaigns.get(customerIdValue) ?? []) as T[]);
  }

  mutateCampaigns(
    _refreshToken: string,
    _customerId: string,
    operations: unknown[],
  ): Promise<unknown> {
    this.campaignMutations.push(...operations);
    return Promise.resolve({});
  }

  mutateCampaignBudgets(
    _refreshToken: string,
    _customerId: string,
    operations: unknown[],
  ): Promise<unknown> {
    this.budgetMutations.push(...operations);
    return Promise.resolve({});
  }
}

function account(overrides: Partial<ProviderAccount> = {}): ProviderAccount {
  return {
    id: 'account-1',
    workspaceId: 'workspace-1',
    platform: 'google_ads',
    externalId: '222',
    name: 'Lulu Berlin Ads',
    currency: 'EUR',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    token: 'refresh-1',
    tokenExpiresAt: null,
    ...overrides,
  };
}

function provider(client = new FakeClient()) {
  return {
    client,
    instance: new GoogleAdsProvider({
      client,
      apiPublicUrl: 'https://api.lulu.test/',
    }),
  };
}

describe('GoogleAdsProvider', () => {
  it('builds the consent URL with the Google Ads callback', () => {
    const { client, instance } = provider();
    expect(instance.authorizeUrl('state-1')).toContain('state=state-1');
    expect(client.lastAuthorize).toEqual({
      state: 'state-1',
      redirectUri: 'https://api.lulu.test/api/v1/ad-accounts/callback/google_ads',
    });
  });

  it('requires a refresh token from Google', async () => {
    const { client, instance } = provider();
    client.tokens = { ...client.tokens, refreshToken: null };

    await expect(instance.exchangeCode('code')).rejects.toThrow(/refresh token/i);
  });

  it('discovers non-manager accounts that have an eligible campaign', async () => {
    const { instance } = provider();

    const result = await instance.exchangeCode('code');

    expect(result.token).toBe('refresh-1');
    expect(result.expiresAt).toBeNull();
    expect(result.accounts).toEqual([
      {
        externalId: '222',
        name: 'Lulu Berlin Ads',
        currency: 'EUR',
        scopes: ['https://www.googleapis.com/auth/adwords'],
      },
    ]);
  });

  it('maps Search, Display and YouTube campaigns to monthly budgets in the account currency', async () => {
    const { client, instance } = provider();
    client.campaigns.set('222', [
      {
        campaign: {
          id: 1001,
          name: 'Search leads',
          status: 'ENABLED',
          startDate: '2026-06-01',
          advertisingChannelType: 'SEARCH',
        },
        campaignBudget: { amountMicros: '100000000', currencyCode: 'EUR' },
      },
      {
        campaign: {
          id: 1002,
          name: 'Display awareness',
          status: 'PAUSED',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          advertisingChannelType: 'DISPLAY',
        },
        // The campaign budget's own currency is ignored: the account currency wins.
        campaignBudget: { amountMicros: '50000000', currencyCode: 'USD' },
      },
      {
        campaign: {
          id: 1003,
          name: 'YouTube reach',
          status: 'REMOVED',
          startDate: '2026-08-01',
          advertisingChannelType: 'VIDEO',
        },
        campaignBudget: { amountMicros: '25000000', currencyCode: 'EUR' },
      },
      {
        campaign: {
          id: 1004,
          name: 'Not eligible',
          status: 'ENABLED',
          startDate: '2026-08-01',
          advertisingChannelType: 'PERFORMANCE_MAX',
        },
        campaignBudget: { amountMicros: '10000000', currencyCode: 'EUR' },
      },
    ]);

    const campaigns = await instance.listCampaigns(account());

    expect(campaigns).toEqual([
      {
        externalId: '1001',
        name: 'Search leads',
        status: 'live',
        objective: 'Search',
        audienceSummary: null,
        startAt: new Date('2026-06-01T00:00:00.000Z'),
        endAt: null,
        budget: { amount: 3040, currency: 'EUR' },
        budgetPeriod: 'monthly',
      },
      {
        externalId: '1002',
        name: 'Display awareness',
        status: 'paused',
        objective: 'Display',
        audienceSummary: null,
        startAt: new Date('2026-07-01T00:00:00.000Z'),
        endAt: new Date('2026-07-31T23:59:59.999Z'),
        budget: { amount: 1520, currency: 'EUR' },
        budgetPeriod: 'monthly',
      },
      {
        externalId: '1003',
        name: 'YouTube reach',
        status: 'ended',
        objective: 'YouTube',
        audienceSummary: null,
        startAt: new Date('2026-08-01T00:00:00.000Z'),
        endAt: null,
        budget: { amount: 760, currency: 'EUR' },
        budgetPeriod: 'monthly',
      },
    ]);
  });

  it('aggregates spend, conversions, leads, revenue and zero calls by campaign/day', async () => {
    const { client, instance } = provider();
    client.metricRows = [
      {
        campaign: { id: 1001 },
        segments: { date: '2026-10-01' },
        metrics: {
          impressions: '120',
          clicks: '7',
          costMicros: '12340000',
          conversions: '3.6',
          conversionsValue: '45.5',
        },
      },
      {
        campaign: { id: 1002 },
        segments: { date: '2026-10-01' },
        metrics: {
          impressions: '50',
          clicks: '2',
          costMicros: '5000000',
          conversions: '1.5',
          conversionsValue: '12.25',
        },
      },
      {
        campaign: { id: 1001 },
        segments: { date: '2026-10-02' },
        metrics: {
          impressions: '10',
          clicks: '1',
          costMicros: '1000000',
          conversions: '0.4',
          conversionsValue: '0',
        },
      },
    ];

    const days = await instance.metrics(
      account(),
      new Date('2026-10-01T13:00:00.000Z'),
      new Date('2026-10-02T01:00:00.000Z'),
    );

    expect(days).toHaveLength(3);
    expect(days[0]).toMatchObject({
      externalId: '1001',
      date: new Date('2026-10-01T00:00:00.000Z'),
      impressions: 120,
      clicks: 7,
      conversions: 4,
      leads: 4,
      calls: 0,
      spend: { amount: 12.34, currency: 'EUR' },
      revenue: { amount: 45.5, currency: 'EUR' },
    });
    expect(days[1]).toMatchObject({
      externalId: '1002',
      date: new Date('2026-10-01T00:00:00.000Z'),
      conversions: 2,
      leads: 2,
      calls: 0,
      spend: { amount: 5, currency: 'EUR' },
      revenue: { amount: 12.25, currency: 'EUR' },
    });
    expect(days[2]).toMatchObject({
      externalId: '1001',
      date: new Date('2026-10-02T00:00:00.000Z'),
      conversions: 0,
      leads: 0,
      calls: 0,
      spend: { amount: 1, currency: 'EUR' },
      revenue: { amount: 0, currency: 'EUR' },
    });
  });

  it('pauses and resumes through campaigns:mutate', async () => {
    const { client, instance } = provider();

    await instance.setStatus(account(), '1001', 'paused');
    await instance.setStatus(account(), '1001', 'live');

    expect(client.campaignMutations).toEqual([
      {
        update: { resourceName: 'customers/222/campaigns/1001', status: 'PAUSED' },
        updateMask: 'status',
      },
      {
        update: { resourceName: 'customers/222/campaigns/1001', status: 'ENABLED' },
        updateMask: 'status',
      },
    ]);
  });

  it('converts monthly and daily budgets to Google daily micros before mutating', async () => {
    const { client, instance } = provider();

    await instance.setBudget(account(), '1001', { amount: 3040, currency: 'EUR' }, 'monthly');
    await instance.setBudget(account(), '1001', { amount: 100, currency: 'EUR' }, 'daily');

    expect(client.budgetMutations).toEqual([
      {
        update: {
          resourceName: 'customers/222/campaignBudgets/9001',
          amountMicros: '100000000',
        },
        updateMask: 'amount_micros',
      },
      {
        update: {
          resourceName: 'customers/222/campaignBudgets/9001',
          amountMicros: '100000000',
        },
        updateMask: 'amount_micros',
      },
    ]);
  });

  it('refuses a total budget without mutating', async () => {
    const { client, instance } = provider();

    await expect(
      instance.setBudget(account(), '1001', { amount: 3040, currency: 'EUR' }, 'total'),
    ).rejects.toThrow(/monthly or daily/);
    expect(client.budgetMutations).toHaveLength(0);
  });

  it('refuses a shared budget without mutating', async () => {
    const { client, instance } = provider();
    client.budgetShared = true;

    await expect(
      instance.setBudget(account(), '1001', { amount: 3040, currency: 'EUR' }, 'monthly'),
    ).rejects.toThrow(/shared budget/);
    expect(client.budgetMutations).toHaveLength(0);
  });

  it('rejects a budget in another currency', async () => {
    const { instance } = provider();
    await expect(
      instance.setBudget(account(), '1001', { amount: 3040, currency: 'USD' }, 'monthly'),
    ).rejects.toThrow(/does not match/);
  });

  it('rejects campaign creation with the Google Ads manual step', async () => {
    const { instance } = provider();
    await expect(instance.pushCampaign(account(), { id: 'campaign-1' } as never)).rejects.toThrow(
      /Create the campaign in Google Ads, then sync it into Lulu/,
    );
  });
});
