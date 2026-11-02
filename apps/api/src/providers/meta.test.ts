import type { Campaign } from '@lulu/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  MetaAdsProvider,
  fromMinorUnits,
  mapMetaStatus,
  metaObjectiveFor,
  toMinorUnits,
} from './meta';
import { MetaGraphClient } from './metaClient';
import type { ProviderAccount } from './types';

type Handler = (url: URL, init: RequestInit) => unknown;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Routes "METHOD /path" to a handler that returns a body (or a Response).
function fakeGraph(handlers: Record<string, Handler>) {
  return vi.fn((input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    const handler = handlers[key];
    if (handler === undefined) {
      return Promise.resolve(
        jsonResponse({ error: { message: `unhandled ${key}`, code: 1 } }, 404),
      );
    }
    const value = handler(url, init ?? {});
    return Promise.resolve(value instanceof Response ? value : jsonResponse(value));
  });
}

function createProvider(fetchMock: ReturnType<typeof fakeGraph>) {
  return new MetaAdsProvider({
    client: new MetaGraphClient({
      appId: 'app-id',
      appSecret: 'app-secret',
      fetch: fetchMock,
      now: () => Date.parse('2026-11-02T12:00:00.000Z'),
    }),
    apiPublicUrl: 'https://api.lulu.test/',
  });
}

const account: ProviderAccount = {
  id: 'account-1',
  workspaceId: 'workspace-1',
  platform: 'meta_ads',
  externalId: '111',
  name: 'Studio',
  currency: 'EUR',
  scopes: ['ads_read', 'ads_management'],
  token: 'token-1',
  tokenExpiresAt: null,
};

function formBody(init: RequestInit): URLSearchParams {
  return new URLSearchParams(typeof init.body === 'string' ? init.body : '');
}

describe('Meta helpers', () => {
  it('converts money to and from minor units', () => {
    expect(toMinorUnits(150, 'EUR')).toBe(15000);
    expect(toMinorUnits(19.99, 'EUR')).toBe(1999);
    expect(toMinorUnits(15000, 'JPY')).toBe(15000);
    expect(fromMinorUnits('15000', 'EUR')).toBe(150);
    expect(fromMinorUnits('15000', 'JPY')).toBe(15000);
    expect(fromMinorUnits(undefined, 'EUR')).toBe(0);
  });

  it('maps statuses and objectives', () => {
    expect(mapMetaStatus('ACTIVE')).toBe('live');
    expect(mapMetaStatus('PAUSED')).toBe('paused');
    expect(mapMetaStatus('ARCHIVED')).toBe('ended');
    expect(mapMetaStatus('DELETED')).toBe('ended');
    expect(mapMetaStatus(undefined)).toBe('paused');
    expect(metaObjectiveFor('Qualified lead generation')).toBe('OUTCOME_LEADS');
    expect(metaObjectiveFor('Awareness and lead capture')).toBe('OUTCOME_AWARENESS');
    expect(metaObjectiveFor('Website traffic')).toBe('OUTCOME_TRAFFIC');
    expect(metaObjectiveFor('Online sales')).toBe('OUTCOME_SALES');
  });
});

describe('MetaAdsProvider', () => {
  it('builds the authorize URL with the Meta callback', () => {
    const provider = createProvider(fakeGraph({}));
    const url = new URL(provider.authorizeUrl('state-1'));

    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.lulu.test/api/v1/ad-accounts/callback/meta_ads',
    );
    expect(url.searchParams.get('state')).toBe('state-1');
  });

  it('connects: long-lived token, open ad accounts only, granted scopes', async () => {
    let tokenCalls = 0;
    const fetchMock = fakeGraph({
      'POST /v26.0/oauth/access_token': () => {
        tokenCalls += 1;
        return tokenCalls === 1
          ? { access_token: 'short-token' }
          : { access_token: 'long-token', expires_in: 5_184_000 };
      },
      'GET /v26.0/me/adaccounts': () => ({
        data: [
          { account_id: '111', name: 'Studio', currency: 'EUR', account_status: 1 },
          { account_id: '222', name: 'Closed', currency: 'EUR', account_status: 101 },
        ],
      }),
      'GET /v26.0/me/permissions': () => ({
        data: [
          { permission: 'ads_read', status: 'granted' },
          { permission: 'ads_management', status: 'granted' },
          { permission: 'business_management', status: 'declined' },
        ],
      }),
    });
    const provider = createProvider(fetchMock);

    const result = await provider.exchangeCode('auth-code');

    expect(result.token).toBe('long-token');
    expect(result.expiresAt).toEqual(
      new Date(Date.parse('2026-11-02T12:00:00.000Z') + 5_184_000 * 1000),
    );
    expect(result.accounts).toEqual([
      {
        externalId: '111',
        name: 'Studio',
        currency: 'EUR',
        scopes: ['ads_read', 'ads_management'],
      },
    ]);
  });

  it('lists campaigns with status, objective and budget period', async () => {
    const fetchMock = fakeGraph({
      'GET /v26.0/act_111/campaigns': () => ({
        data: [
          {
            id: 'c1',
            name: 'Studio awareness',
            status: 'ACTIVE',
            objective: 'OUTCOME_AWARENESS',
            daily_budget: '15000',
            start_time: '2026-06-08T00:00:00+0000',
            stop_time: '2026-07-08T23:59:59+0000',
          },
          {
            id: 'c2',
            name: 'Lead gen',
            status: 'PAUSED',
            objective: 'OUTCOME_LEADS',
            lifetime_budget: '450000',
          },
          { id: 'c3', name: 'Old', status: 'ARCHIVED', objective: 'OUTCOME_SALES' },
        ],
      }),
    });
    const provider = createProvider(fetchMock);

    const campaigns = await provider.listCampaigns(account);

    expect(campaigns).toHaveLength(3);
    expect(campaigns[0]).toMatchObject({
      externalId: 'c1',
      status: 'live',
      objective: 'Awareness',
      budget: { amount: 150, currency: 'EUR' },
      budgetPeriod: 'daily',
      startAt: new Date('2026-06-08T00:00:00.000Z'),
      endAt: new Date('2026-07-08T23:59:59.000Z'),
    });
    expect(campaigns[1]).toMatchObject({
      status: 'paused',
      objective: 'Lead generation',
      budget: { amount: 4500, currency: 'EUR' },
      budgetPeriod: 'total',
    });
    expect(campaigns[2]).toMatchObject({
      status: 'ended',
      budget: { amount: 0, currency: 'EUR' },
      budgetPeriod: 'daily',
    });
  });

  it('reads budgets of zero-decimal currencies as they are', async () => {
    const fetchMock = fakeGraph({
      'GET /v26.0/act_111/campaigns': () => ({
        data: [{ id: 'c1', name: 'Tokyo', status: 'ACTIVE', daily_budget: '15000' }],
      }),
    });
    const provider = createProvider(fetchMock);

    const campaigns = await provider.listCampaigns({ ...account, currency: 'JPY' });

    expect(campaigns[0]!.budget).toEqual({ amount: 15000, currency: 'JPY' });
  });

  it('maps daily insights to metric days', async () => {
    const fetchMock = fakeGraph({
      'GET /v26.0/act_111/insights': () => ({
        data: [
          {
            campaign_id: 'c1',
            date_start: '2026-06-10',
            impressions: '800',
            clicks: '20',
            spend: '8.25',
            actions: [
              { action_type: 'omni_purchase', value: '2' },
              { action_type: 'purchase', value: '2' },
            ],
            action_values: [
              { action_type: 'omni_purchase', value: '240.5' },
              { action_type: 'purchase', value: '240.5' },
            ],
          },
          {
            campaign_id: 'c1',
            date_start: '2026-06-09',
            impressions: '1000',
            clicks: '50',
            spend: '12.5',
            actions: [
              { action_type: 'lead', value: '3' },
              { action_type: 'link_click', value: '50' },
            ],
          },
        ],
      }),
    });
    const provider = createProvider(fetchMock);

    const days = await provider.metrics(
      account,
      new Date('2026-06-09T10:00:00Z'),
      new Date('2026-06-10T22:00:00Z'),
    );

    expect(days).toEqual([
      {
        externalId: 'c1',
        date: new Date('2026-06-09T00:00:00.000Z'),
        impressions: 1000,
        clicks: 50,
        conversions: 3,
        leads: 3,
        calls: 0,
        spend: { amount: 12.5, currency: 'EUR' },
        revenue: { amount: 0, currency: 'EUR' },
      },
      {
        externalId: 'c1',
        date: new Date('2026-06-10T00:00:00.000Z'),
        impressions: 800,
        clicks: 20,
        conversions: 2,
        leads: 0,
        calls: 0,
        spend: { amount: 8.25, currency: 'EUR' },
        revenue: { amount: 240.5, currency: 'EUR' },
      },
    ]);

    const query = new URL(String(fetchMock.mock.calls[0]![0])).searchParams;
    expect(query.get('level')).toBe('campaign');
    expect(query.get('time_increment')).toBe('1');
    expect(query.get('time_range')).toBe('{"since":"2026-06-09","until":"2026-06-10"}');
  });

  it('creates a paused campaign with a Meta objective', async () => {
    const fetchMock = fakeGraph({
      'POST /v26.0/act_111/campaigns': () => ({ id: 'meta-new-1' }),
    });
    const provider = createProvider(fetchMock);

    const result = await provider.pushCampaign(account, {
      id: 'lulu-1',
      name: 'Spring launch',
      objective: 'Qualified leads',
    } as unknown as Campaign);

    expect(result).toEqual({ externalId: 'meta-new-1' });
    const body = formBody(fetchMock.mock.calls[0]![1] as RequestInit);
    expect(body.get('name')).toBe('Spring launch');
    expect(body.get('objective')).toBe('OUTCOME_LEADS');
    expect(body.get('status')).toBe('PAUSED');
    expect(body.get('special_ad_categories')).toBe('[]');
  });

  it('fails a push when Meta returns no id', async () => {
    const fetchMock = fakeGraph({ 'POST /v26.0/act_111/campaigns': () => ({}) });
    const provider = createProvider(fetchMock);

    await expect(
      provider.pushCampaign(account, {
        id: 'lulu-1',
        name: 'X',
        objective: 'Leads',
      } as unknown as Campaign),
    ).rejects.toThrow('Meta did not return an id');
  });

  it('pauses and resumes a campaign', async () => {
    const fetchMock = fakeGraph({ 'POST /v26.0/c1': () => ({ success: true }) });
    const provider = createProvider(fetchMock);

    await provider.setStatus(account, 'c1', 'paused');
    await provider.setStatus(account, 'c1', 'live');

    const calls = fetchMock.mock.calls as Array<[unknown, RequestInit]>;
    expect(formBody(calls[0]![1]).get('status')).toBe('PAUSED');
    expect(formBody(calls[1]![1]).get('status')).toBe('ACTIVE');
  });

  it('sets a daily or a lifetime budget in minor units', async () => {
    const fetchMock = fakeGraph({ 'POST /v26.0/c1': () => ({ success: true }) });
    const provider = createProvider(fetchMock);

    await provider.setBudget(account, 'c1', { amount: 150, currency: 'EUR' }, 'daily');
    await provider.setBudget(account, 'c1', { amount: 4500, currency: 'EUR' }, 'total');

    const calls = fetchMock.mock.calls as Array<[unknown, RequestInit]>;
    expect(formBody(calls[0]![1]).get('daily_budget')).toBe('15000');
    expect(formBody(calls[1]![1]).get('lifetime_budget')).toBe('450000');
  });

  it('rejects a monthly budget or another currency without calling Meta', async () => {
    const fetchMock = fakeGraph({});
    const provider = createProvider(fetchMock);

    await expect(
      provider.setBudget(account, 'c1', { amount: 3000, currency: 'EUR' }, 'monthly'),
    ).rejects.toThrow('not monthly');
    await expect(
      provider.setBudget(account, 'c1', { amount: 100, currency: 'USD' }, 'daily'),
    ).rejects.toThrow('does not match');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a Meta API error with its classification', async () => {
    const fetchMock = fakeGraph({
      'GET /v26.0/act_111/campaigns': () =>
        jsonResponse({ error: { message: 'Session has expired.', code: 190 } }, 400),
    });
    const provider = createProvider(fetchMock);

    await expect(provider.listCampaigns(account)).rejects.toMatchObject({
      name: 'MetaApiError',
      kind: 'auth_expired',
    });
  });
});
