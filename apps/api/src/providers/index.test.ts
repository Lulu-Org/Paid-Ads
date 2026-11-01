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

  it('fails fast when a platform is set to live before its connector exists', async () => {
    vi.stubEnv('ADS_PROVIDER_GOOGLE_ADS', 'live');
    const { assertProviderConfiguration, getAdsProvider } = await import('./index');

    expect(() => getAdsProvider('google_ads')).toThrow(/No live provider is implemented/);
    expect(() => assertProviderConfiguration()).toThrow(/ADS_PROVIDER_GOOGLE_ADS=simulated/);
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

  it('knows that live Google LSA cannot create campaigns', async () => {
    const { campaignCreationSupported } = await import('./index');

    expect(campaignCreationSupported('google_lsa', 'simulated')).toBe(true);
    expect(campaignCreationSupported('google_lsa', 'live')).toBe(false);
    expect(campaignCreationSupported('google_ads', 'live')).toBe(true);
    expect(campaignCreationSupported('linkedin_ads', 'live')).toBe(false);
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
    await expect(import('./index')).rejects.toThrow(/LINKEDIN_CLIENT_ID/);
  });
});
