import { describe, expect, it, vi } from 'vitest';
import {
  GoogleAdsApiError,
  GoogleAdsClient,
  customerId,
  type GoogleAdsClientOptions,
} from './googleLsaClient';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function tokenResponse(accessToken = 'access-1', extra: Record<string, unknown> = {}): Response {
  return jsonResponse({
    access_token: accessToken,
    refresh_token: 'refresh-1',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/adwords',
    ...extra,
  });
}

function createClient(
  fetchMock: ReturnType<typeof vi.fn>,
  options: Partial<GoogleAdsClientOptions> = {},
) {
  return new GoogleAdsClient({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    developerToken: 'developer-token',
    loginCustomerId: '9999999999',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => Date.parse('2026-10-31T12:00:00.000Z'),
    ...options,
  });
}

function fetchCalls(fetchMock: ReturnType<typeof vi.fn>): Array<{
  url: unknown;
  init: RequestInit;
}> {
  return (fetchMock.mock.calls as Array<[unknown, RequestInit]>).map(([url, init]) => ({
    url,
    init,
  }));
}

function bodyText(init: RequestInit): string {
  const body = init.body;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return '';
}

function jsonBody(init: RequestInit): unknown {
  return JSON.parse(bodyText(init)) as unknown;
}

describe('GoogleAdsClient', () => {
  it('builds the consent URL with the adwords scope and offline access', () => {
    const client = createClient(vi.fn());
    const url = new URL(client.authorizeUrl('state value', 'https://api.lulu.test/callback'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.lulu.test/callback');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/adwords');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state value');
  });

  it('exchanges an authorization code and returns the refresh token and scopes', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse());
    const client = createClient(fetchMock);

    const tokens = await client.exchangeCode('auth-code', 'https://api.lulu.test/callback');

    expect(tokens).toMatchObject({
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    const calls = fetchCalls(fetchMock);
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token');
    expect(bodyText(calls[0]!.init)).toContain('grant_type=authorization_code');
    expect(bodyText(calls[0]!.init)).toContain('code=auth-code');
    expect(bodyText(calls[0]!.init)).toContain('client_secret=client-secret');
    expect(bodyText(calls[0]!.init)).toContain(
      'redirect_uri=https%3A%2F%2Fapi.lulu.test%2Fcallback',
    );
  });

  it('caches the access token and sends the Google Ads headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ results: [{ campaign: { id: '1' } }] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const client = createClient(fetchMock);

    await client.search('refresh-1', 'customers/123', 'SELECT campaign.id FROM campaign');
    await client.search('refresh-1', '123', 'SELECT campaign.id FROM campaign');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchCalls(fetchMock);
    expect(calls[1]!.url).toBe(
      'https://googleads.googleapis.com/v26/customers/123/googleAds:search',
    );
    expect(calls[1]!.init.headers).toMatchObject({
      authorization: 'Bearer access-1',
      'developer-token': 'developer-token',
      'login-customer-id': '9999999999',
    });
  });

  it('refreshes the access token once after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('expired-token'))
      .mockResolvedValueOnce(jsonResponse({ error: { status: 'UNAUTHENTICATED' } }, 401))
      .mockResolvedValueOnce(tokenResponse('fresh-token'))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const client = createClient(fetchMock);

    await expect(
      client.search('refresh-1', '123', 'SELECT campaign.id FROM campaign'),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const calls = fetchCalls(fetchMock);
    expect(calls[2]!.url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[3]!.init.headers).toMatchObject({ authorization: 'Bearer fresh-token' });
  });

  it('paginates search results with pageToken', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 1 }], nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 2 }] }));
    const client = createClient(fetchMock);

    await expect(client.search('refresh-1', '123', 'query')).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);

    const calls = fetchCalls(fetchMock);
    const firstBody = jsonBody(calls[1]!.init);
    const secondBody = jsonBody(calls[2]!.init);
    expect(firstBody).toEqual({ query: 'query' });
    expect(secondBody).toEqual({ query: 'query', pageToken: 'page-2' });
  });

  it('lists accessible customers and mutates campaigns and budgets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resourceNames: ['customers/111', 'customers/222'] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const client = createClient(fetchMock);

    await expect(client.listAccessibleCustomers('refresh-1')).resolves.toEqual(['111', '222']);
    await client.mutateCampaigns('refresh-1', '111', [{ update: { status: 'PAUSED' } }]);
    await client.mutateCampaignBudgets('refresh-1', '111', [{ update: { amountMicros: '10' } }]);

    const calls = fetchCalls(fetchMock);
    expect(calls[1]!.url).toBe(
      'https://googleads.googleapis.com/v26/customers:listAccessibleCustomers',
    );
    expect(calls[2]!.url).toBe(
      'https://googleads.googleapis.com/v26/customers/111/campaigns:mutate',
    );
    expect(jsonBody(calls[2]!.init)).toEqual({
      operations: [{ update: { status: 'PAUSED' } }],
    });
    expect(calls[3]!.url).toBe(
      'https://googleads.googleapis.com/v26/customers/111/campaignBudgets:mutate',
    );
  });

  it('throws a sanitized error without tokens', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('secret-access-token'))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 400,
              status: 'INVALID_ARGUMENT',
              message: 'Request contains an invalid argument.',
              details: [
                {
                  errors: [
                    {
                      message: 'Unrecognized field in the query.',
                      errorCode: { queryError: 'UNRECOGNIZED_FIELD' },
                    },
                  ],
                },
              ],
            },
          },
          400,
          { 'request-id': 'request-1' },
        ),
      );
    const client = createClient(fetchMock);

    const error = await client
      .search('refresh-1', '123', 'bad query')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GoogleAdsApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'UNRECOGNIZED_FIELD',
      message: 'Unrecognized field in the query.',
      requestId: 'request-1',
    });
    expect(String((error as Error).message)).not.toContain('secret-access-token');
    expect(String((error as Error).message)).not.toContain('refresh-1');
    expect(String((error as Error).message)).not.toContain('client-secret');
  });

  it('strips the customers/ prefix from ids', () => {
    expect(customerId('customers/123')).toBe('123');
    expect(customerId('123')).toBe('123');
  });
});
