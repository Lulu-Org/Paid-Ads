import type { Campaign } from '@lulu/shared';
import { describe, expect, it } from 'vitest';
import {
  LINKEDIN_API_URL,
  LINKEDIN_TOKEN_URL,
  LinkedInApiError,
  ProviderOperationUnsupportedError,
  createLinkedInProvider,
  mapLinkedInAnalytics,
  mapLinkedInCampaign,
} from './linkedin';
import type { ProviderAccount } from './types';

const config = {
  clientId: 'client-123',
  clientSecret: 'secret-456',
  apiVersion: '202610',
  redirectUri: 'https://api.example.com/api/v1/ad-accounts/callback/linkedin_ads',
};

const account: ProviderAccount = {
  id: 'acc_1',
  workspaceId: 'ws_1',
  platform: 'linkedin_ads',
  externalId: '507404993',
  name: 'Lulu Intelligence Page',
  currency: 'EUR',
  scopes: ['r_ads', 'r_ads_reporting', 'rw_ads'],
  token: 'token-abc',
  tokenExpiresAt: null,
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A fake fetch that answers in order and records every request. */
function fakeFetch(...responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fn = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 500, body: { message: 'no response queued' } };
    const status = next.status ?? 200;
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(next.body ?? {}), { status }),
    );
  };
  return { fn, calls };
}

const header = (call: Call, name: string) => (call.init?.headers as Record<string, string>)[name];

describe('LinkedIn provider', () => {
  it('builds the sign-in link with our app, callback, scopes and state', () => {
    const url = new URL(createLinkedInProvider(config).authorizeUrl('signed-state'));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toBe('r_ads r_ads_reporting rw_ads');
  });

  it('exchanges the code for a token and lists the active ad accounts', async () => {
    const { fn, calls } = fakeFetch(
      {
        body: {
          access_token: 'token-abc',
          expires_in: 5184000,
          scope: 'r_ads,r_ads_reporting,rw_ads',
        },
      },
      {
        body: {
          elements: [
            { id: 507404993, name: 'Lulu Intelligence Page', currency: 'EUR', status: 'ACTIVE' },
          ],
        },
      },
    );
    const result = await createLinkedInProvider(config, fn).exchangeCode('auth-code');

    expect(calls[0]!.url).toBe(LINKEDIN_TOKEN_URL);
    const form = new URLSearchParams(calls[0]!.init!.body as string);
    expect(form.get('code')).toBe('auth-code');
    expect(form.get('client_secret')).toBe('secret-456');
    expect(calls[1]!.url).toContain('/adAccounts?q=search&search=(status:(values:List(ACTIVE)))');
    expect(header(calls[1]!, 'Authorization')).toBe('Bearer token-abc');
    expect(header(calls[1]!, 'LinkedIn-Version')).toBe('202610');
    expect(header(calls[1]!, 'X-Restli-Protocol-Version')).toBe('2.0.0');

    expect(result.token).toBe('token-abc');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.accounts).toEqual([
      {
        externalId: '507404993',
        name: 'Lulu Intelligence Page',
        currency: 'EUR',
        scopes: ['r_ads', 'r_ads_reporting', 'rw_ads'],
      },
    ]);
  });

  it('lists campaigns across pages, maps statuses and leaves removed ones out', async () => {
    const { fn, calls } = fakeFetch(
      {
        body: {
          elements: [
            {
              id: 1001,
              name: 'B2B pipeline · Q4',
              status: 'ACTIVE',
              objectiveType: 'LEAD_GENERATION',
              runSchedule: { start: Date.UTC(2026, 9, 1), end: Date.UTC(2026, 11, 31) },
              totalBudget: { amount: '2500.00', currencyCode: 'EUR' },
            },
            { id: 1002, name: 'Old test', status: 'REMOVED' },
          ],
          metadata: { nextPageToken: 'page-2' },
        },
      },
      { body: { elements: [{ id: 1003, name: 'Draft idea', status: 'DRAFT' }] } },
    );
    const campaigns = await createLinkedInProvider(config, fn).listCampaigns(account);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe(
      `${LINKEDIN_API_URL}/adAccounts/507404993/adCampaigns?q=search&pageSize=100`,
    );
    expect(calls[1]!.url).toContain('pageToken=page-2');
    expect(campaigns.map((c) => [c.externalId, c.status])).toEqual([
      ['1001', 'live'],
      ['1003', 'draft'],
    ]);
    expect(campaigns[0]).toMatchObject({
      objective: 'LEAD_GENERATION',
      budget: { amount: 2500, currency: 'EUR' },
      budgetPeriod: 'total',
      startAt: new Date(Date.UTC(2026, 9, 1)),
    });
    // No budget at all: zero in the account currency, not a made-up amount.
    expect(campaigns[1]!.budget).toEqual({ amount: 0, currency: 'EUR' });
  });

  it('reads daily analytics per campaign with Rest.li dates and the encoded account URN', async () => {
    const { fn, calls } = fakeFetch({
      body: {
        elements: [
          {
            pivotValues: ['urn:li:sponsoredCampaign:1001'],
            dateRange: { start: { year: 2026, month: 10, day: 30 } },
            impressions: 1200,
            clicks: 48,
            costInLocalCurrency: '96.40',
            externalWebsiteConversions: 3,
            oneClickLeads: 5,
            conversionValueInLocalCurrency: '600.00',
          },
          { dateRange: { start: { year: 2026, month: 10, day: 30 } } },
        ],
      },
    });
    const days = await createLinkedInProvider(config, fn).metrics(
      account,
      new Date(Date.UTC(2026, 9, 1)),
      new Date(Date.UTC(2026, 9, 30)),
    );

    const url = calls[0]!.url;
    expect(url).toContain('q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY');
    expect(url).toContain(
      'dateRange=(start:(year:2026,month:10,day:1),end:(year:2026,month:10,day:30))',
    );
    expect(url).toContain('accounts=List(urn%3Ali%3AsponsoredAccount%3A507404993)');
    expect(days).toEqual([
      {
        externalId: '1001',
        date: new Date(Date.UTC(2026, 9, 30)),
        impressions: 1200,
        clicks: 48,
        calls: 0,
        conversions: 8,
        leads: 5,
        spend: { amount: 96.4, currency: 'EUR' },
        revenue: { amount: 600, currency: 'EUR' },
      },
    ]);
  });

  it('pauses, resumes and sets the total budget with partial updates', async () => {
    const { fn, calls } = fakeFetch(
      { status: 204 },
      { status: 204 },
      { status: 204 },
      { status: 204 },
    );
    const provider = createLinkedInProvider(config, fn);
    await provider.setStatus(account, '1001', 'paused');
    await provider.setStatus(account, '1001', 'live');
    await provider.setBudget(account, '1001', { amount: 3000, currency: 'EUR' }, 'total');
    await provider.setBudget(account, '1001', { amount: 100, currency: 'EUR' }, 'daily');

    expect(calls[0]!.url).toBe(`${LINKEDIN_API_URL}/adAccounts/507404993/adCampaigns/1001`);
    expect(calls[0]!.init!.method).toBe('POST');
    expect(header(calls[0]!, 'X-RestLi-Method')).toBe('PARTIAL_UPDATE');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({
      patch: { $set: { status: 'PAUSED' } },
    });
    expect(JSON.parse(calls[1]!.init!.body as string)).toEqual({
      patch: { $set: { status: 'ACTIVE' } },
    });
    expect(JSON.parse(calls[2]!.init!.body as string)).toEqual({
      patch: { $set: { totalBudget: { amount: '3000.00', currencyCode: 'EUR' } } },
    });
    expect(JSON.parse(calls[3]!.init!.body as string)).toEqual({
      patch: { $set: { dailyBudget: { amount: '100.00', currencyCode: 'EUR' } } },
    });
  });

  it('refuses a monthly budget without calling LinkedIn', async () => {
    const { fn, calls } = fakeFetch();
    await expect(
      createLinkedInProvider(config, fn).setBudget(
        account,
        '1001',
        { amount: 3000, currency: 'EUR' },
        'monthly',
      ),
    ).rejects.toThrow(/not monthly/);
    expect(calls).toHaveLength(0);
  });

  it('refuses a budget in another currency without calling LinkedIn', async () => {
    const { fn, calls } = fakeFetch();
    await expect(
      createLinkedInProvider(config, fn).setBudget(
        account,
        '1001',
        { amount: 3000, currency: 'USD' },
        'total',
      ),
    ).rejects.toThrow(/does not match account currency EUR/);
    expect(calls).toHaveLength(0);
  });

  it('does not pretend to create campaigns', async () => {
    const { fn, calls } = fakeFetch();
    await expect(
      createLinkedInProvider(config, fn).pushCampaign(account, {} as Campaign),
    ).rejects.toBeInstanceOf(ProviderOperationUnsupportedError);
    expect(calls).toHaveLength(0);
  });

  it('turns API errors into LinkedInApiError and marks rate limits as retryable', async () => {
    const { fn } = fakeFetch(
      { status: 429, body: { serviceErrorCode: 101, message: 'Too many requests' } },
      { status: 403, body: { message: 'Not enough permissions' } },
    );
    const provider = createLinkedInProvider(config, fn);

    const rateLimited = await provider.listCampaigns(account).catch((e: unknown) => e);
    expect(rateLimited).toBeInstanceOf(LinkedInApiError);
    expect((rateLimited as LinkedInApiError).retryable).toBe(true);
    expect((rateLimited as LinkedInApiError).serviceErrorCode).toBe(101);

    const forbidden = (await provider
      .listCampaigns(account)
      .catch((e: unknown) => e)) as LinkedInApiError;
    expect(forbidden.status).toBe(403);
    expect(forbidden.retryable).toBe(false);
    expect(forbidden.message).toContain('Not enough permissions');
  });
});

describe('LinkedIn mapping', () => {
  it('maps finished campaigns to ended and skips pending deletion', () => {
    expect(mapLinkedInCampaign({ id: 1, name: 'x', status: 'COMPLETED' }, 'EUR')?.status).toBe(
      'ended',
    );
    expect(mapLinkedInCampaign({ id: 1, name: 'x', status: 'PENDING_DELETION' }, 'EUR')).toBeNull();
    expect(mapLinkedInCampaign({ id: 1, name: 'x', status: 'SOMETHING_NEW' }, 'EUR')).toBeNull();
  });

  it('skips analytics rows without a campaign or date', () => {
    expect(mapLinkedInAnalytics({ impressions: 5 }, 'EUR')).toBeNull();
  });
});
