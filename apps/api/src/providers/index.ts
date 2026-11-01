import { adPlatforms, type AdPlatform } from '@lulu/shared';
import { env, type AdsProviderMode } from '../config/env';
import { GoogleAdsClient } from './googleLsaClient';
import { GoogleLsaProvider } from './googleLsa';
import { createLinkedInProvider } from './linkedin';
import { simulatedProviders } from './simulated';
import type { AdsProvider } from './types';

// Per-platform provider registry. C1 adds the live Google LSA connector and C4 LinkedIn; C2-C3 add
// the rest. A platform configured as `live` without a connector fails fast instead of falling back
// to sample data.

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

function linkedInCredentialsError(): Error {
  return new Error(
    'ADS_PROVIDER_LINKEDIN_ADS=live requires LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_API_VERSION',
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

let liveLinkedInProvider: AdsProvider | null = null;

function getLinkedInProvider(): AdsProvider {
  if (liveLinkedInProvider !== null) return liveLinkedInProvider;

  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_API_VERSION } = env;
  if (
    LINKEDIN_CLIENT_ID === undefined ||
    LINKEDIN_CLIENT_SECRET === undefined ||
    LINKEDIN_API_VERSION === undefined
  ) {
    throw linkedInCredentialsError();
  }

  liveLinkedInProvider = createLinkedInProvider({
    clientId: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    apiVersion: LINKEDIN_API_VERSION,
    redirectUri: `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/ad-accounts/callback/linkedin_ads`,
  });
  return liveLinkedInProvider;
}

export function getAdsProvider(platform: AdPlatform): AdsProvider {
  if (providerModeFor(platform) === 'simulated') {
    return simulatedProviders[platform];
  }
  if (platform === 'google_lsa') {
    return getGoogleLsaProvider();
  }
  if (platform === 'linkedin_ads') {
    return getLinkedInProvider();
  }
  throw liveProviderError(platform);
}

/**
 * Whether launching a draft can create the campaign remotely. Neither the Google Ads API (standalone
 * Local Services) nor our LinkedIn connector (campaign group, targeting and creatives are not modeled
 * yet) can create campaigns, so a live draft on those platforms must already have a remote campaign.
 */
export function campaignCreationSupported(
  platform: AdPlatform,
  mode: AdsProviderMode = providerModeFor(platform),
): boolean {
  if (mode !== 'live') return true;
  return platform !== 'google_lsa' && platform !== 'linkedin_ads';
}

/** Fails at startup when a platform is configured for a live provider that cannot be built. */
export function assertProviderConfiguration(): void {
  for (const platform of adPlatforms) {
    if (providerModeFor(platform) !== 'live') continue;
    if (platform === 'google_lsa') {
      getGoogleLsaProvider();
      continue;
    }
    if (platform === 'linkedin_ads') {
      getLinkedInProvider();
      continue;
    }
    throw liveProviderError(platform);
  }
}

export type { AdsProvider } from './types';
