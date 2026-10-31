import { adPlatforms, type AdPlatform } from '@lulu/shared';
import { env, type AdsProviderMode } from '../config/env';
import { GoogleAdsClient } from './googleLsaClient';
import { GoogleLsaProvider } from './googleLsa';
import { simulatedProviders } from './simulated';
import type { AdsProvider } from './types';

// Per-platform provider registry. C1 adds the live Google LSA connector; C2-C4 add the rest. A
// platform configured as `live` without a connector fails fast instead of falling back to sample data.

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

function googleLsaCredentialsError(): Error {
  return new Error(
    'ADS_PROVIDER_GOOGLE_LSA=live requires GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET',
  );
}

let liveGoogleLsaProvider: AdsProvider | null = null;

function getGoogleLsaProvider(): AdsProvider {
  if (liveGoogleLsaProvider !== null) return liveGoogleLsaProvider;

  const { GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET } = env;
  if (
    GOOGLE_ADS_DEVELOPER_TOKEN === undefined ||
    GOOGLE_ADS_CLIENT_ID === undefined ||
    GOOGLE_ADS_CLIENT_SECRET === undefined
  ) {
    throw googleLsaCredentialsError();
  }

  const client = new GoogleAdsClient({
    clientId: GOOGLE_ADS_CLIENT_ID,
    clientSecret: GOOGLE_ADS_CLIENT_SECRET,
    developerToken: GOOGLE_ADS_DEVELOPER_TOKEN,
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
  });
  liveGoogleLsaProvider = new GoogleLsaProvider({
    client,
    apiPublicUrl: env.API_PUBLIC_URL,
  });
  return liveGoogleLsaProvider;
}

export function getAdsProvider(platform: AdPlatform): AdsProvider {
  if (providerModeFor(platform) === 'simulated') {
    return simulatedProviders[platform];
  }
  if (platform === 'google_lsa') {
    return getGoogleLsaProvider();
  }
  throw liveProviderError(platform);
}

/**
 * Whether launching a draft can create the campaign remotely. The Google Ads API cannot create
 * standalone Local Services campaigns, so a live LSA draft must already have a remote campaign.
 */
export function campaignCreationSupported(
  platform: AdPlatform,
  mode: AdsProviderMode = providerModeFor(platform),
): boolean {
  return !(platform === 'google_lsa' && mode === 'live');
}

/** Fails at startup when a platform is configured for a live provider that cannot be built. */
export function assertProviderConfiguration(): void {
  for (const platform of adPlatforms) {
    if (providerModeFor(platform) !== 'live') continue;
    if (platform === 'google_lsa') {
      getGoogleLsaProvider();
      continue;
    }
    throw liveProviderError(platform);
  }
}

export type { AdsProvider } from './types';
