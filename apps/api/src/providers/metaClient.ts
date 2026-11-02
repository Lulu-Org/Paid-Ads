import { createHmac } from 'node:crypto';

// Minimal Meta Graph / Marketing API client (docs/api.md "Ad accounts and providers"). No vendor SDK:
// OAuth and Marketing API calls go over `fetch`, every call carries appsecret_proof, and every error
// is sanitized before it can reach a log or the API response. The access token only travels to Meta
// (query string or form body) and is never part of an error message.

export const META_SCOPES = ['ads_read', 'ads_management', 'business_management'];
export const DEFAULT_META_API_VERSION = 'v26.0';

const MAX_PAGES = 100;
const AUTH_ERROR_CODES = new Set([102, 190]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);

export interface MetaGraphClientOptions {
  appId: string;
  appSecret: string;
  apiVersion?: string | undefined;
  fetch?: typeof fetch | undefined;
  now?: (() => number) | undefined;
  baseUrl?: string | undefined;
  authorizeUrl?: string | undefined;
}

export interface MetaTokenResult {
  accessToken: string;
  expiresAt: Date | null;
}

export type MetaErrorKind = 'auth_expired' | 'rate_limited' | 'other';

export class MetaApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly subcode: number | null;
  readonly traceId: string | null;
  readonly kind: MetaErrorKind;

  constructor(
    status: number,
    code: number | null,
    subcode: number | null,
    message: string,
    traceId: string | null,
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.traceId = traceId;
    if (status === 401 || (code !== null && AUTH_ERROR_CODES.has(code))) {
      this.kind = 'auth_expired';
    } else if (status === 429 || (code !== null && RATE_LIMIT_CODES.has(code))) {
      this.kind = 'rate_limited';
    } else {
      this.kind = 'other';
    }
  }
}

interface MetaErrorPayload {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface MetaPage<T> {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

function parseBody(text: string): unknown {
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function hasError(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as MetaErrorPayload).error === 'object'
  );
}

function toError(status: number, payload: unknown): MetaApiError {
  const error = (payload as MetaErrorPayload).error;
  return new MetaApiError(
    status,
    typeof error?.code === 'number' ? error.code : null,
    typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    typeof error?.message === 'string' && error.message.length > 0
      ? error.message
      : `Meta API request failed with status ${status}`,
    typeof error?.fbtrace_id === 'string' ? error.fbtrace_id : null,
  );
}

export class MetaGraphClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private readonly authorizeEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: MetaGraphClientOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    const version = options.apiVersion ?? DEFAULT_META_API_VERSION;
    this.baseUrl = (options.baseUrl ?? `https://graph.facebook.com/${version}`).replace(/\/$/, '');
    this.authorizeEndpoint =
      options.authorizeUrl ?? `https://www.facebook.com/${version}/dialog/oauth`;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', META_SCOPES.join(','));
    url.searchParams.set('state', state);
    return url.toString();
  }

  // The code gives a short-lived user token; it is exchanged straight away for a long-lived one
  // (about 60 days). Meta has no refresh token: the user has to connect again when it expires.
  async exchangeCode(code: string, redirectUri: string): Promise<MetaTokenResult> {
    const short = await this.tokenRequest({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    });
    return this.tokenRequest({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: short.accessToken,
    });
  }

  get<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>(token, 'GET', path, params);
  }

  post<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>(token, 'POST', path, params);
  }

  // Follows paging by cursor rather than the `next` URL, because that URL carries the access token.
  async getAll<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T[]> {
    const rows: T[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = after === undefined ? params : { ...params, after };
      const result = await this.get<MetaPage<T>>(token, path, query);
      rows.push(...(result.data ?? []));
      const cursor = result.paging?.cursors?.after;
      if (result.paging?.next === undefined || cursor === undefined) break;
      after = cursor;
    }
    return rows;
  }

  private proof(token: string): string {
    return createHmac('sha256', this.appSecret).update(token).digest('hex');
  }

  private async tokenRequest(params: Record<string, string>): Promise<MetaTokenResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    const payload = parseBody(await response.text()) as MetaErrorPayload & {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || payload.access_token === undefined) {
      throw toError(response.status, payload);
    }
    return {
      accessToken: payload.access_token,
      expiresAt:
        typeof payload.expires_in === 'number'
          ? new Date(this.now() + payload.expires_in * 1000)
          : null,
    };
  }

  private async request<T>(
    token: string,
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const all = { ...params, access_token: token, appsecret_proof: this.proof(token) };
    const query = new URLSearchParams(all).toString();
    const response =
      method === 'GET'
        ? await this.fetchImpl(`${this.baseUrl}${path}?${query}`, {
            method,
            headers: { accept: 'application/json' },
          })
        : await this.fetchImpl(`${this.baseUrl}${path}`, {
            method,
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: query,
          });
    const payload = parseBody(await response.text());
    if (!response.ok || hasError(payload)) throw toError(response.status, payload);
    return payload as T;
  }
}
