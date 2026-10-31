import { adPlatforms, type AdPlatform } from '@lulu/shared';
import { env, type AdsProviderMode } from '../config/env';
import { simulatedProviders } from './simulated';
import type { AdsProvider } from './types';

// Per-platform provider registry. C1-C4 add live implementations; until then `live` fails fast
// instead of silently falling back to sample data.

export function providerModeFor(platform: AdPlatform): AdsProviderMode {
  switch (platform) {
    case 'google_lsa':
      return env.ADS_PROVIDER_GOOGLE_LSA;
    case 'google_ads':
      return env.ADS_PROVIDER_GOOGLE_ADS;
    case 'meta_ads':
      return env.ADS_PROVIDER_META_ADS;
    case 'linkedin_ads':
      return env.ADS_PROVIDER_LINKEDIN_ADS;
  }
}

function liveProviderError(platform: AdPlatform): Error {
  return new Error(
    `No live provider is implemented for ${platform}; set ADS_PROVIDER_${platform.toUpperCase()}=simulated`,
  );
}

export function getAdsProvider(platform: AdPlatform): AdsProvider {
  if (providerModeFor(platform) === 'live') {
    throw liveProviderError(platform);
  }
  return simulatedProviders[platform];
}

/** Fails at startup when a platform is configured for a live provider that does not exist yet. */
export function assertProviderConfiguration(): void {
  for (const platform of adPlatforms) {
    if (providerModeFor(platform) === 'live') {
      throw liveProviderError(platform);
    }
  }
}

export type { AdsProvider } from './types';
