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
});
