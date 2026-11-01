import { describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthTokenResult } from './googleLsaClient';
import {
  GoogleLsaProvider,
  dailyMicrosToMonthly,
  monthlyToDailyMicros,
  type GoogleLsaClient,
} from './googleLsa';
import type { ProviderAccount } from './types';

interface CampaignRow {
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
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

class FakeClient implements GoogleLsaClient {
  tokens: GoogleOAuthTokenResult = {
    refreshToken: 'refresh-1',
    accessToken: 'access-1',
    expiresAt: new Date('2026-10-31T13:00:00.000Z'),
    scopes: ['https://www.googleapis.com/auth/adwords'],
  };
  accessible: string[] = ['111', '222', '333'];
  customers = new Map<string, CustomerRow>([
    ['111', { customer: { id: 111, descriptiveName: 'Manager', manager: true } }],
    ['222', { customer: { id: 222, descriptiveName: 'Lulu Berlin Local', currencyCode: 'EUR' } }],
    ['333', { customer: { id: 333, descriptiveName: 'No LSA campaigns', currencyCode: 'EUR' } }],
  ]);
  campaigns = new Map<string, CampaignRow[]>([
    [
      '222',
      [
        {
          campaign: {
            id: 1001,
            name: 'Local service calls',
            status: 'ENABLED',
            startDate: '2026-06-01',
            endDate: '2026-06-30',
          },
          campaignBudget: { amountMicros: '100000000', currencyCode: 'EUR' },
        },
      ],
    ],
  ]);
  metricRows: unknown[] = [];
  leadRows: unknown[] = [];
  budgetResource = 'customers/222/campaignBudgets/9001';
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
    if (query.includes('FROM local_services_lead')) {
      return Promise.resolve(this.leadRows as T[]);
    }
    if (query.includes('campaign.campaign_budget')) {
      return Promise.resolve([
        { campaign: { id: 1001, campaignBudget: this.budgetResource } },
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
    platform: 'google_lsa',
    externalId: '222',
    name: 'Lulu Berlin Local',
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
    instance: new GoogleLsaProvider({
      client,
      apiPublicUrl: 'https://api.lulu.test/',
    }),
  };
}

describe('GoogleLsaProvider', () => {
  it('builds the consent URL with the API callback', () => {
    const { client, instance } = provider();
    expect(instance.authorizeUrl('state-1')).toContain('state=state-1');
    expect(client.lastAuthorize).toEqual({
      state: 'state-1',
      redirectUri: 'https://api.lulu.test/api/v1/ad-accounts/callback/google_lsa',
    });
  });

  it('requires a refresh token from Google', async () => {
    const { client, instance } = provider();
    client.tokens = { ...client.tokens, refreshToken: null };

    await expect(instance.exchangeCode('code')).rejects.toThrow(/refresh token/i);
  });

  it('discovers non-manager accounts that have LSA campaigns', async () => {
    const { instance } = provider();

    const result = await instance.exchangeCode('code');

    expect(result.token).toBe('refresh-1');
    expect(result.expiresAt).toBeNull();
    expect(result.accounts).toEqual([
      {
        externalId: '222',
        name: 'Lulu Berlin Local',
        currency: 'EUR',
        scopes: ['https://www.googleapis.com/auth/adwords'],
      },
    ]);
  });

  it('lists standalone LSA and Local Services Performance Max campaigns with monthly budgets', async () => {
    const { client, instance } = provider();
    client.campaigns.set('222', [
      {
        campaign: {
          id: 1001,
          name: 'Local service calls',
          status: 'ENABLED',
          startDate: '2026-06-01',
        },
        campaignBudget: { amountMicros: '100000000', currencyCode: 'EUR' },
      },
      {
        campaign: {
          id: 1002,
          name: 'Paused LSA PMax',
          status: 'PAUSED',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
        campaignBudget: { amountMicros: '50000000', currencyCode: 'EUR' },
      },
    ]);

    const campaigns = await instance.listCampaigns(account());

    expect(campaigns).toEqual([
      {
        externalId: '1001',
        name: 'Local service calls',
        status: 'live',
        objective: 'Local Services leads',
        audienceSummary: null,
        startAt: new Date('2026-06-01T00:00:00.000Z'),
        endAt: null,
        budget: { amount: 3040, currency: 'EUR' },
        budgetPeriod: 'monthly',
      },
      {
        externalId: '1002',
        name: 'Paused LSA PMax',
        status: 'paused',
        objective: 'Local Services leads',
        audienceSummary: null,
        startAt: new Date('2026-07-01T00:00:00.000Z'),
        endAt: new Date('2026-07-31T23:59:59.999Z'),
        budget: { amount: 1520, currency: 'EUR' },
        budgetPeriod: 'monthly',
      },
    ]);
  });

  it('reconciles spend, charged leads and phone calls by campaign/day', async () => {
    const { client, instance } = provider();
    client.metricRows = [
      {
        campaign: { id: 1001 },
        segments: { date: '2026-10-01' },
        metrics: { impressions: '120', clicks: '7', costMicros: '12340000' },
      },
    ];
    client.leadRows = [
      {
        localServicesLead: {
          campaign: 'customers/222/campaigns/1001',
          leadType: 'PHONE_CALL',
          creationDateTime: '2026-10-01 09:15:00',
          leadCharged: true,
        },
      },
      {
        localServicesLead: {
          campaign: 'customers/222/campaigns/1001',
          leadType: 'PHONE_CALL',
          creationDateTime: '2026-10-01 17:45:00',
          leadCharged: true,
        },
      },
      {
        localServicesLead: {
          campaign: 'customers/222/campaigns/1001',
          leadType: 'MESSAGE',
          creationDateTime: '2026-10-01 18:00:00',
          leadCharged: true,
        },
      },
      {
        localServicesLead: {
          campaign: 'customers/222/campaigns/1001',
          leadType: 'MESSAGE',
          creationDateTime: '2026-10-01 18:30:00',
          leadCharged: false,
        },
      },
      {
        localServicesLead: {
          campaign: 'customers/222/campaigns/1001',
          leadType: 'PHONE_CALL',
          creationDateTime: '2026-10-02 08:00:00',
          leadCharged: true,
        },
      },
    ];

    const days = await instance.metrics(
      account(),
      new Date('2026-10-01T13:00:00.000Z'),
      new Date('2026-10-02T01:00:00.000Z'),
    );

    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({
      externalId: '1001',
      date: new Date('2026-10-01T00:00:00.000Z'),
      impressions: 120,
      clicks: 7,
      leads: 3,
      conversions: 3,
      calls: 2,
      spend: { amount: 12.34, currency: 'EUR' },
      revenue: { amount: 0, currency: 'EUR' },
    });
    expect(days[1]).toMatchObject({
      externalId: '1001',
      date: new Date('2026-10-02T00:00:00.000Z'),
      impressions: 0,
      clicks: 0,
      leads: 1,
      conversions: 1,
      calls: 1,
      spend: { amount: 0, currency: 'EUR' },
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

  it('converts the monthly budget to Google daily micros before mutating', async () => {
    const { client, instance } = provider();

    await instance.setBudget(account(), '1001', { amount: 3040, currency: 'EUR' }, 'monthly');

    expect(client.budgetMutations).toEqual([
      {
        update: {
          resourceName: 'customers/222/campaignBudgets/9001',
          amountMicros: '100000000',
        },
        updateMask: 'amount_micros',
      },
    ]);
  });

  it('rejects a budget in another currency', async () => {
    const { instance } = provider();
    await expect(
      instance.setBudget(account(), '1001', { amount: 3040, currency: 'USD' }, 'monthly'),
    ).rejects.toThrow(/does not match/);
  });

  it('sends a daily budget as is and refuses a total budget without mutating', async () => {
    const { client, instance } = provider();

    await instance.setBudget(account(), '1001', { amount: 100, currency: 'EUR' }, 'daily');
    expect(client.budgetMutations).toEqual([
      {
        update: {
          resourceName: 'customers/222/campaignBudgets/9001',
          amountMicros: '100000000',
        },
        updateMask: 'amount_micros',
      },
    ]);

    await expect(
      instance.setBudget(account(), '1001', { amount: 3040, currency: 'EUR' }, 'total'),
    ).rejects.toThrow(/monthly or daily/);
    expect(client.budgetMutations).toHaveLength(1);
  });

  it('rejects campaign creation with a clear error', async () => {
    const { instance } = provider();
    await expect(instance.pushCampaign(account(), { id: 'campaign-1' } as never)).rejects.toThrow(
      /not supported by the Google Ads API/,
    );
  });

  it('converts between monthly budgets and daily micros', () => {
    expect(dailyMicrosToMonthly('100000000')).toBe(3040);
    expect(monthlyToDailyMicros(3040)).toBe(100000000);
    expect(monthlyToDailyMicros(1000)).toBe(Math.round((1000 / 30.4) * 1_000_000));
  });

  it('does not log or return tokens in provider errors', async () => {
    const { client, instance } = provider();
    client.mutateCampaigns = vi.fn().mockRejectedValue(new Error('provider failed'));

    await expect(instance.setStatus(account(), '1001', 'paused')).rejects.toThrow(
      'provider failed',
    );
  });
});
