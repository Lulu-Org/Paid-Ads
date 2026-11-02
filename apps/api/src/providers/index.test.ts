import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('provider registry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('defaults every platform to the simulated provider', async () => {
    const { getAdsProvider, providerModeFor } = await import('./index');

    expect(providerModeFor('google_lsa')).toBe('simulated');
    expect(providerModeFor('google_ads')).toBe('simulated');
    expect(providerModeFor('meta_ads')).toBe('simulated');
    expect(providerModeFor('linkedin_ads')).toBe('simulated');
    expect(getAdsProvider('google_ads').platform).toBe('google_ads');
  });

  it('returns the live Google LSA provider when its credentials are set', async () => {
    vi.stubEnv('ADS_PROVIDER_GOOGLE_LSA', 'live');
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'developer-token');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret');
    const { assertProviderConfiguration, getAdsProvider, providerModeFor } =
      await import('./index');

    expect(providerModeFor('google_lsa')).toBe('live');
    expect(getAdsProvider('google_lsa').platform).toBe('google_lsa');
    expect(() => assertProviderConfiguration()).not.toThrow();
  });

  it('knows which live connectors cannot create campaigns', async () => {
    const { campaignCreationSupported } = await import('./index');

    expect(campaignCreationSupported('google_lsa', 'simulated')).toBe(true);
    expect(campaignCreationSupported('google_lsa', 'live')).toBe(false);
    expect(campaignCreationSupported('google_ads', 'simulated')).toBe(true);
    expect(campaignCreationSupported('google_ads', 'live')).toBe(false);
    expect(campaignCreationSupported('meta_ads', 'live')).toBe(true);
    expect(campaignCreationSupported('linkedin_ads', 'live')).toBe(false);
  });

  it('returns the live Google Ads provider when its credentials are set', async () => {
    vi.stubEnv('ADS_PROVIDER_GOOGLE_ADS', 'live');
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'developer-token');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com/');
    const { assertProviderConfiguration, getAdsProvider, providerModeFor } =
      await import('./index');

    expect(providerModeFor('google_ads')).toBe('live');
    expect(getAdsProvider('google_ads').platform).toBe('google_ads');
    expect(() => assertProviderConfiguration()).not.toThrow();
    const url = new URL(getAdsProvider('google_ads').authorizeUrl('state'));
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/v1/ad-accounts/callback/google_ads',
    );
  });

  it('refuses to start Google Ads live without its Google credentials', async () => {
    vi.stubEnv('ADS_PROVIDER_GOOGLE_ADS', 'live');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', '');
    // The env check stops the process before any provider is built.
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(import('./index')).rejects.toThrow('exit 1');
    expect(String(log.mock.calls[0]?.[0])).toMatch(/GOOGLE_ADS_CLIENT_ID/);
    exit.mockRestore();
    log.mockRestore();
  });

  it('uses the live Meta connector when configured', async () => {
    vi.stubEnv('ADS_PROVIDER_META_ADS', 'live');
    vi.stubEnv('META_APP_ID', 'app-123');
    vi.stubEnv('META_APP_SECRET', 'secret-456');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com/');
    const { assertProviderConfiguration, getAdsProvider, providerModeFor } =
      await import('./index');

    expect(providerModeFor('meta_ads')).toBe('live');
    expect(getAdsProvider('meta_ads').platform).toBe('meta_ads');
    expect(() => assertProviderConfiguration()).not.toThrow();
    const url = new URL(getAdsProvider('meta_ads').authorizeUrl('state'));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.pathname).toBe('/v26.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/v1/ad-accounts/callback/meta_ads',
    );
  });

  it('refuses to start Meta live without its app credentials', async () => {
    vi.stubEnv('ADS_PROVIDER_META_ADS', 'live');
    vi.stubEnv('META_APP_ID', '');
    // The env check stops the process before any provider is built.
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(import('./index')).rejects.toThrow('exit 1');
    expect(String(log.mock.calls[0]?.[0])).toMatch(/META_APP_ID/);
    exit.mockRestore();
    log.mockRestore();
  });

  it('uses the live LinkedIn connector when configured', async () => {
    vi.stubEnv('ADS_PROVIDER_LINKEDIN_ADS', 'live');
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'client-123');
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret-456');
    vi.stubEnv('LINKEDIN_API_VERSION', '202610');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com/');
    const { assertProviderConfiguration, getAdsProvider } = await import('./index');

    expect(() => assertProviderConfiguration()).not.toThrow();
    const url = new URL(getAdsProvider('linkedin_ads').authorizeUrl('state'));
    expect(url.hostname).toBe('www.linkedin.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/v1/ad-accounts/callback/linkedin_ads',
    );
  });

  it('refuses to start LinkedIn live without its app credentials', async () => {
    vi.stubEnv('ADS_PROVIDER_LINKEDIN_ADS', 'live');
    vi.stubEnv('LINKEDIN_CLIENT_ID', '');
    // The env check stops the process before any provider is built.
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(import('./index')).rejects.toThrow('exit 1');
    expect(String(log.mock.calls[0]?.[0])).toMatch(/LINKEDIN_CLIENT_ID/);
    exit.mockRestore();
    log.mockRestore();
  });
});
