import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MetaApiError, MetaGraphClient, type MetaGraphClientOptions } from './metaClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createClient(
  fetchMock: ReturnType<typeof vi.fn>,
  options: Partial<MetaGraphClientOptions> = {},
) {
  return new MetaGraphClient({
    appId: 'app-id',
    appSecret: 'app-secret',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => Date.parse('2026-11-02T12:00:00.000Z'),
    ...options,
  });
}

function fetchCalls(
  fetchMock: ReturnType<typeof vi.fn>,
): Array<{ url: string; init: RequestInit }> {
  return (fetchMock.mock.calls as Array<[unknown, RequestInit]>).map(([url, init]) => ({
    url: String(url),
    init,
  }));
}

function bodyText(init: RequestInit): string {
  return typeof init.body === 'string' ? init.body : '';
}

describe('MetaGraphClient', () => {
  it('builds the consent URL with the ads scopes', () => {
    const client = createClient(vi.fn());
    const url = new URL(client.authorizeUrl('state value', 'https://api.lulu.test/callback'));

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v26.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('app-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.lulu.test/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('ads_read,ads_management,business_management');
    expect(url.searchParams.get('state')).toBe('state value');
  });

  it('exchanges the code for a short-lived token, then a long-lived one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'long-token', expires_in: 5_184_000 }));
    const client = createClient(fetchMock);

    const tokens = await client.exchangeCode('auth-code', 'https://api.lulu.test/callback');

    expect(tokens.accessToken).toBe('long-token');
    expect(tokens.expiresAt?.toISOString()).toBe(
      new Date(Date.parse('2026-11-02T12:00:00.000Z') + 5_184_000 * 1000).toISOString(),
    );
    const calls = fetchCalls(fetchMock);
    expect(calls[0]!.url).toBe('https://graph.facebook.com/v26.0/oauth/access_token');
    expect(calls[0]!.init.method).toBe('POST');
    expect(bodyText(calls[0]!.init)).toContain('code=auth-code');
    expect(bodyText(calls[0]!.init)).toContain('client_secret=app-secret');
    expect(bodyText(calls[1]!.init)).toContain('grant_type=fb_exchange_token');
    expect(bodyText(calls[1]!.init)).toContain('fb_exchange_token=short-token');
  });

  it('sends the token with an appsecret_proof on every call', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [] }));
    const client = createClient(fetchMock);

    await client.get('token-1', '/me/adaccounts', { fields: 'account_id' });

    const url = new URL(fetchCalls(fetchMock)[0]!.url);
    expect(url.pathname).toBe('/v26.0/me/adaccounts');
    expect(url.searchParams.get('access_token')).toBe('token-1');
    expect(url.searchParams.get('fields')).toBe('account_id');
    expect(url.searchParams.get('appsecret_proof')).toBe(
      createHmac('sha256', 'app-secret').update('token-1').digest('hex'),
    );
  });

  it('posts form-encoded parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true }));
    const client = createClient(fetchMock);

    await client.post('token-1', '/123', { status: 'PAUSED' });

    const call = fetchCalls(fetchMock)[0]!;
    expect(call.url).toBe('https://graph.facebook.com/v26.0/123');
    expect(call.init.method).toBe('POST');
    expect(bodyText(call.init)).toContain('status=PAUSED');
    expect(bodyText(call.init)).toContain('access_token=token-1');
  });

  it('paginates by cursor instead of following the next URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: '1' }],
          paging: {
            cursors: { after: 'cursor-1' },
            next: 'https://graph.facebook.com/next?access_token=x',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: '2' }], paging: { cursors: { after: 'cursor-2' } } }),
      );
    const client = createClient(fetchMock);

    await expect(client.getAll('token-1', '/act_1/campaigns')).resolves.toEqual([
      { id: '1' },
      { id: '2' },
    ]);

    const calls = fetchCalls(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(calls[1]!.url).searchParams.get('after')).toBe('cursor-1');
  });

  it('throws a sanitized error and classifies it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              message: 'Error validating access token: Session has expired.',
              type: 'OAuthException',
              code: 190,
              error_subcode: 463,
              fbtrace_id: 'trace-1',
            },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Too many calls.', code: 17 } }, 400))
      .mockResolvedValueOnce(new Response('upstream exploded', { status: 502 }));
    const client = createClient(fetchMock);

    const expired = await client.get('secret-token', '/me').catch((error: unknown) => error);
    expect(expired).toBeInstanceOf(MetaApiError);
    expect(expired).toMatchObject({
      status: 400,
      code: 190,
      subcode: 463,
      traceId: 'trace-1',
      kind: 'auth_expired',
    });
    expect((expired as Error).message).not.toContain('secret-token');
    expect((expired as Error).message).not.toContain('app-secret');

    const limited = await client.get('secret-token', '/me').catch((error: unknown) => error);
    expect(limited).toMatchObject({ code: 17, kind: 'rate_limited' });

    const broken = await client.get('secret-token', '/me').catch((error: unknown) => error);
    expect(broken).toMatchObject({
      status: 502,
      code: null,
      kind: 'other',
      message: 'Meta API request failed with status 502',
    });
  });

  it('turns a failed token exchange into an error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: 'This authorization code has been used.', code: 100 } },
          400,
        ),
      );
    const client = createClient(fetchMock);

    await expect(
      client.exchangeCode('used-code', 'https://api.lulu.test/cb'),
    ).rejects.toMatchObject({
      name: 'MetaApiError',
      code: 100,
    });
  });
});
