import { createHash } from 'node:crypto';
import type { AdPlatform, Campaign, CampaignStatus, Money } from '@lulu/shared';
import { env } from '../config/env';
import type {
  AdsProvider,
  ExchangeCodeResult,
  ExternalAccount,
  ExternalCampaign,
  ExternalMetricDay,
  ProviderAccount,
  PushCampaignResult,
} from './types';

// Answers with the design's sample data so every view works before a live platform connection.
// Everything is deterministic: the same account, campaign and day always produce the same numbers,
// and a pushed campaign gets the same external id on every retry.

const SAMPLE_ACCOUNTS: Record<AdPlatform, ExternalAccount> = {
  google_lsa: {
    externalId: 'account_google_lsa_ext',
    name: 'Lulu Berlin Local',
    currency: 'EUR',
    scopes: ['read', 'manage'],
  },
  google_ads: {
    externalId: 'account_google_ads_ext',
    name: 'Lulu Growth · 123-456',
    currency: 'EUR',
    scopes: ['read', 'manage'],
  },
  meta_ads: {
    externalId: 'account_meta_ext',
    name: 'Lulu Studio Business',
    currency: 'EUR',
    scopes: ['read', 'manage'],
  },
  linkedin_ads: {
    externalId: 'account_linkedin_ext',
    name: 'Lulu Intelligence Page',
    currency: 'EUR',
    scopes: ['read', 'manage'],
  },
};

interface SampleCampaign {
  externalId: string;
  name: string;
  status: CampaignStatus;
  objective: string;
  audienceSummary: string | null;
  startAt: string | null;
  endAt: string | null;
  budget: Money;
}

const SAMPLE_CAMPAIGNS: Record<AdPlatform, SampleCampaign[]> = {
  google_lsa: [
    {
      externalId: 'lsa_2001',
      name: 'Local service calls',
      status: 'live',
      objective: 'Local phone calls',
      audienceSummary: 'Service area · 25 km radius',
      startAt: '2026-06-01T00:00:00.000Z',
      endAt: null,
      budget: { amount: 3000, currency: 'EUR' },
    },
  ],
  google_ads: [
    {
      externalId: 'g_1001',
      name: 'Spring launch · Berlin',
      status: 'live',
      objective: 'Qualified lead generation',
      audienceSummary: 'Berlin · Decision makers · 25–54',
      startAt: '2026-06-01T00:00:00.000Z',
      endAt: '2026-06-30T23:59:59.000Z',
      budget: { amount: 6000, currency: 'EUR' },
    },
  ],
  meta_ads: [
    {
      externalId: 'm_3001',
      name: 'Studio awareness',
      status: 'live',
      objective: 'Awareness and lead capture',
      audienceSummary: 'Lookalike · Website visitors · 1%',
      startAt: '2026-06-08T00:00:00.000Z',
      endAt: '2026-07-08T23:59:59.000Z',
      budget: { amount: 4500, currency: 'EUR' },
    },
  ],
  // LinkedIn has no campaigns in the design sample data.
  linkedin_ads: [],
};

const DAY_MS = 86_400_000;

function fraction(seed: string): number {
  return createHash('sha256').update(seed).digest().readUInt32BE(0) / 2 ** 32;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toCampaign(sample: SampleCampaign): ExternalCampaign {
  return {
    externalId: sample.externalId,
    name: sample.name,
    status: sample.status,
    objective: sample.objective,
    audienceSummary: sample.audienceSummary,
    startAt: sample.startAt === null ? null : new Date(sample.startAt),
    endAt: sample.endAt === null ? null : new Date(sample.endAt),
    budget: sample.budget,
  };
}

function metricDay(externalId: string, date: Date): ExternalMetricDay {
  const key = `${externalId}:${date.toISOString().slice(0, 10)}`;
  const impressions = 400 + Math.round(fraction(`${key}:impressions`) * 4600);
  const clicks = Math.max(1, Math.round(impressions * (0.02 + fraction(`${key}:clicks`) * 0.04)));
  const leads = Math.max(0, Math.round(clicks * (0.008 + fraction(`${key}:leads`) * 0.02)));
  const spendAmount = Math.round((20 + fraction(`${key}:spend`) * 160) * 100) / 100;
  const revenueAmount =
    Math.round(spendAmount * (1.8 + fraction(`${key}:revenue`) * 2.2) * 100) / 100;
  return {
    externalId,
    date,
    impressions,
    clicks,
    conversions: leads,
    leads,
    spend: { amount: spendAmount, currency: 'EUR' },
    revenue: { amount: revenueAmount, currency: 'EUR' },
  };
}

export class SimulatedAdsProvider implements AdsProvider {
  readonly platform: AdPlatform;

  constructor(platform: AdPlatform) {
    this.platform = platform;
  }

  authorizeUrl(state: string): string {
    const base = env.API_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/api/v1/ad-accounts/callback/${this.platform}?code=simulated-${this.platform}&state=${encodeURIComponent(state)}`;
  }

  exchangeCode(_code: string): Promise<ExchangeCodeResult> {
    return Promise.resolve({
      token: `simulated-token:${this.platform}`,
      expiresAt: null,
      accounts: [SAMPLE_ACCOUNTS[this.platform]],
    });
  }

  listCampaigns(_account: ProviderAccount): Promise<ExternalCampaign[]> {
    return Promise.resolve(SAMPLE_CAMPAIGNS[this.platform].map(toCampaign));
  }

  metrics(_account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]> {
    const first = startOfUtcDay(from);
    const last = startOfUtcDay(to);
    const days: ExternalMetricDay[] = [];
    for (let time = first.getTime(); time <= last.getTime(); time += DAY_MS) {
      const date = new Date(time);
      for (const campaign of SAMPLE_CAMPAIGNS[this.platform]) {
        days.push(metricDay(campaign.externalId, date));
      }
    }
    return Promise.resolve(days);
  }

  pushCampaign(_account: ProviderAccount, campaign: Campaign): Promise<PushCampaignResult> {
    return Promise.resolve({ externalId: `sim-${this.platform}-${campaign.id}` });
  }

  setStatus(_account: ProviderAccount, _externalId: string, _status: 'live' | 'paused') {
    return Promise.resolve();
  }

  setBudget(_account: ProviderAccount, _externalId: string, _budget: Money) {
    return Promise.resolve();
  }
}

export const simulatedProviders: Record<AdPlatform, AdsProvider> = {
  google_lsa: new SimulatedAdsProvider('google_lsa'),
  google_ads: new SimulatedAdsProvider('google_ads'),
  meta_ads: new SimulatedAdsProvider('meta_ads'),
  linkedin_ads: new SimulatedAdsProvider('linkedin_ads'),
};
