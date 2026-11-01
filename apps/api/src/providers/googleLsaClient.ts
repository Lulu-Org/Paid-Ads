// Minimal Google Ads API v26 REST client (docs/api.md "Ad accounts and providers"), shared by the
// Google LSA (C1) and Google Ads (C2) connectors. No vendor SDK: OAuth tokens and GAQL search go over
// `fetch`, and every error is sanitized before it can reach a log or the API response. Tokens are only
// ever sent in headers or the token request body.

export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
export const DEFAULT_GOOGLE_ADS_API_VERSION = 'v26';
export const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const EXPIRY_SKEW_MS = 60_000;

export interface GoogleAdsClientOptions {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId?: string | undefined;
  apiVersion?: string | undefined;
  fetch?: typeof fetch | undefined;
  now?: (() => number) | undefined;
  baseUrl?: string | undefined;
  authorizeUrl?: string | undefined;
  tokenUrl?: string | undefined;
}

export interface GoogleOAuthTokenResult {
  refreshToken: string | null;
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
}

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number;
}

interface GoogleErrorPayload {
  error?: {
    code?: number | string;
    message?: string;
    status?: string;
    details?: Array<{ errors?: Array<{ message?: string; errorCode?: Record<string, string> }> }>;
  };
  error_description?: string;
}

export class GoogleAdsApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(status: number, code: string | null, message: string, requestId: string | null) {
    super(message);
    this.name = 'GoogleAdsApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function parseBody(text: string): unknown {
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function sanitizedMessage(payload: GoogleErrorPayload, status: number): string {
  const googleError = payload.error?.details
    ?.flatMap((detail) => detail.errors ?? [])
    .find((error) => typeof error.message === 'string');
  if (googleError?.message) return googleError.message;
  if (typeof payload.error?.message === 'string') return payload.error.message;
  if (typeof payload.error_description === 'string') return payload.error_description;
  return `Google Ads API request failed with status ${status}`;
}

function sanitizedCode(payload: GoogleErrorPayload): string | null {
  const googleError = payload.error?.details
    ?.flatMap((detail) => detail.errors ?? [])
    .find((error) => error.errorCode !== undefined);
  if (googleError?.errorCode) {
    const values = Object.values(googleError.errorCode).filter(Boolean);
    if (values.length > 0) return values.join('.');
  }
  return (
    payload.error?.status ?? (payload.error?.code === undefined ? null : String(payload.error.code))
  );
}

/** Strips a `customers/` prefix from a resource name or id. */
export function customerId(value: string): string {
  return value.replace(/^customers\//, '');
}

export class GoogleAdsClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly developerToken: string;
  private readonly loginCustomerId: string | undefined;
  private readonly baseUrl: string;
  private readonly authorizeEndpoint: string;
  private readonly tokenEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly tokenCache = new Map<string, CachedAccessToken>();

  constructor(options: GoogleAdsClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.developerToken = options.developerToken;
    this.loginCustomerId = options.loginCustomerId;
    const version = options.apiVersion ?? DEFAULT_GOOGLE_ADS_API_VERSION;
    this.baseUrl = (options.baseUrl ?? `https://googleads.googleapis.com/${version}`).replace(
      /\/$/,
      '',
    );
    this.authorizeEndpoint = options.authorizeUrl ?? GOOGLE_OAUTH_AUTHORIZE_URL;
    this.tokenEndpoint = options.tokenUrl ?? GOOGLE_OAUTH_TOKEN_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_ADS_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleOAuthTokenResult> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    });
    return this.requestToken(body);
  }

  async listAccessibleCustomers(refreshToken: string): Promise<string[]> {
    const result = (await this.request(
      refreshToken,
      'GET',
      '/customers:listAccessibleCustomers',
    )) as {
      resourceNames?: string[];
    };
    return (result.resourceNames ?? []).map(customerId);
  }

  async search<T>(refreshToken: string, customerIdValue: string, query: string): Promise<T[]> {
    const results: T[] = [];
    let pageToken: string | undefined;
    do {
      const body: Record<string, string> = { query };
      if (pageToken !== undefined) body.pageToken = pageToken;
      const page = (await this.request(
        refreshToken,
        'POST',
        `/customers/${customerId(customerIdValue)}/googleAds:search`,
        body,
      )) as { results?: T[]; nextPageToken?: string };
      results.push(...(page.results ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken !== undefined && pageToken.length > 0);
    return results;
  }

  mutateCampaigns(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown> {
    return this.request(
      refreshToken,
      'POST',
      `/customers/${customerId(customerIdValue)}/campaigns:mutate`,
      { operations },
    );
  }

  mutateCampaignBudgets(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown> {
    return this.request(
      refreshToken,
      'POST',
      `/customers/${customerId(customerIdValue)}/campaignBudgets:mutate`,
      { operations },
    );
  }

  private async requestToken(body: URLSearchParams): Promise<GoogleOAuthTokenResult> {
    const response = await this.fetchImpl(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
    });
    const text = await response.text();
    const payload = parseBody(text) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || payload.access_token === undefined) {
      const message =
        payload.error_description ??
        payload.error ??
        `Google Ads OAuth request failed with status ${response.status}`;
      throw new GoogleAdsApiError(
        response.status,
        payload.error ?? null,
        message,
        response.headers.get('request-id'),
      );
    }
    const expiresInMs = (payload.expires_in ?? 3600) * 1000;
    return {
      refreshToken: payload.refresh_token ?? null,
      accessToken: payload.access_token,
      expiresAt: new Date(this.now() + expiresInMs),
      scopes: (payload.scope ?? '').split(/\s+/).filter((scope) => scope.length > 0),
    };
  }

  private async accessToken(refreshToken: string): Promise<string> {
    const cached = this.tokenCache.get(refreshToken);
    if (cached !== undefined && cached.expiresAt - EXPIRY_SKEW_MS > this.now()) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const tokens = await this.requestToken(body);
    this.tokenCache.set(refreshToken, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt.getTime(),
    });
    return tokens.accessToken;
  }

  private async request(
    refreshToken: string,
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    retryOnUnauthorized = true,
  ): Promise<unknown> {
    const accessToken = await this.accessToken(refreshToken);
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': this.developerToken,
      accept: 'application/json',
    };
    if (this.loginCustomerId !== undefined) {
      headers['login-customer-id'] = this.loginCustomerId;
    }
    if (body !== undefined) headers['content-type'] = 'application/json';

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (response.status === 401 && retryOnUnauthorized) {
      this.tokenCache.delete(refreshToken);
      return this.request(refreshToken, method, path, body, false);
    }

    const text = await response.text();
    const payload = parseBody(text) as GoogleErrorPayload;
    if (!response.ok) {
      throw new GoogleAdsApiError(
        response.status,
        sanitizedCode(payload),
        sanitizedMessage(payload, response.status),
        response.headers.get('request-id'),
      );
    }
    return payload;
  }
}
