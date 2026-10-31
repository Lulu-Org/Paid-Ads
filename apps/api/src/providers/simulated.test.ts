import { adPlatforms, type AdPlatform, type Campaign } from '@lulu/shared';
import { describe, expect, it } from 'vitest';
import { simulatedProviders } from './simulated';
import type { ProviderAccount } from './types';

function account(platform: AdPlatform): ProviderAccount {
  return {
    id: `account-${platform}`,
    workspaceId: 'workspace-1',
    platform,
    externalId: `external-${platform}`,
    name: 'Test account',
    currency: 'EUR',
    scopes: ['read', 'manage'],
    token: 'token',
    tokenExpiresAt: null,
  };
}

describe('SimulatedAdsProvider', () => {
  it('implements every platform with a sample account matching the seed', async () => {
    for (const platform of adPlatforms) {
      const provider = simulatedProviders[platform];
      expect(provider.platform).toBe(platform);

      const exchanged = await provider.exchangeCode('code');
      expect(exchanged.token).toBe(`simulated-token:${platform}`);
      expect(exchanged.expiresAt).toBeNull();
      expect(exchanged.accounts).toHaveLength(1);
      expect(exchanged.accounts[0]?.externalId).toBe(
        {
          google_lsa: 'account_google_lsa_ext',
          google_ads: 'account_google_ads_ext',
          meta_ads: 'account_meta_ext',
          linkedin_ads: 'account_linkedin_ext',
        }[platform],
      );
    }
  });

  it('builds a callback URL that carries the signed state', () => {
    const url = simulatedProviders.google_ads.authorizeUrl('state value');
    expect(url).toContain('/api/v1/ad-accounts/callback/google_ads');
    expect(url).toContain('code=simulated-google_ads');
    expect(url).toContain('state=state%20value');
  });

  it('returns the seeded campaigns and none for LinkedIn', async () => {
    const googleAds = await simulatedProviders.google_ads.listCampaigns(account('google_ads'));
    const lsa = await simulatedProviders.google_lsa.listCampaigns(account('google_lsa'));
    const meta = await simulatedProviders.meta_ads.listCampaigns(account('meta_ads'));
    const linkedin = await simulatedProviders.linkedin_ads.listCampaigns(account('linkedin_ads'));

    expect(googleAds.map((campaign) => campaign.externalId)).toEqual(['g_1001']);
    expect(lsa.map((campaign) => campaign.externalId)).toEqual(['lsa_2001']);
    expect(meta.map((campaign) => campaign.externalId)).toEqual(['m_3001']);
    expect(linkedin).toEqual([]);
  });

  it('generates deterministic daily metrics for the requested range', async () => {
    const provider = simulatedProviders.google_ads;
    const from = new Date('2026-10-01T13:00:00.000Z');
    const to = new Date('2026-10-03T01:00:00.000Z');

    const first = await provider.metrics(account('google_ads'), from, to);
    const second = await provider.metrics(account('google_ads'), from, to);

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first.map((day) => day.date.toISOString().slice(0, 10))).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    for (const day of first) {
      expect(day.externalId).toBe('g_1001');
      expect(day.impressions).toBeGreaterThan(0);
      expect(day.clicks).toBeGreaterThan(0);
      expect(day.spend.currency).toBe('EUR');
      expect(day.revenue.amount).toBeGreaterThan(0);
    }
  });

  it('returns a deterministic external id for a pushed campaign', async () => {
    const provider = simulatedProviders.meta_ads;
    const campaign = { id: 'campaign-123' } as Campaign;

    const first = await provider.pushCampaign(account('meta_ads'), campaign);
    const second = await provider.pushCampaign(account('meta_ads'), campaign);

    expect(first.externalId).toBe('sim-meta_ads-campaign-123');
    expect(second).toEqual(first);
    await expect(provider.setStatus(account('meta_ads'), first.externalId, 'paused')).resolves.toBe(
      undefined,
    );
    await expect(
      provider.setBudget(
        account('meta_ads'),
        first.externalId,
        { amount: 10, currency: 'EUR' },
        'monthly',
      ),
    ).resolves.toBe(undefined);
  });
});
