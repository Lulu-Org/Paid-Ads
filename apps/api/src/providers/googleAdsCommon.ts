import type { CampaignStatus } from '@lulu/shared';
import type { GoogleOAuthTokenResult } from './googleLsaClient';

// Helpers shared by the Google LSA (C1) and Google Ads (C2) connectors. Both talk to the same Google
// Ads API through GoogleAdsClient, so the client shape, budget conversion and response parsing live
// here instead of being copied.

/** Google's average daily budget is read as a monthly amount, the way C1 stores LSA budgets. */
export const MONTHLY_DAYS = 30.4;

/** The subset of the REST client the providers use, so tests can inject a fake. */
export interface GoogleAdsApiClient {
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<GoogleOAuthTokenResult>;
  listAccessibleCustomers(refreshToken: string): Promise<string[]>;
  search<T>(refreshToken: string, customerIdValue: string, query: string): Promise<T[]>;
  mutateCampaigns(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown>;
  mutateCampaignBudgets(
    refreshToken: string,
    customerIdValue: string,
    operations: unknown[],
  ): Promise<unknown>;
}

export function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (value === undefined || value.length === 0) return null;
  const date = new Date(`${value.slice(0, 10)}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateTime(value: string | undefined): Date | null {
  if (value === undefined || value.length === 0) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapStatus(status: string | undefined): CampaignStatus {
  switch (status) {
    case 'ENABLED':
      return 'live';
    case 'REMOVED':
      return 'ended';
    case 'PAUSED':
    default:
      return 'paused';
  }
}

export function campaignIdFromResource(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  const id = value.split('/').filter(Boolean).at(-1);
  return id === undefined ? null : id;
}

/** Google's average daily budget to Lulu's monthly budget. */
export function dailyMicrosToMonthly(amountMicros: string | number | undefined): number {
  return roundMoney((toNumber(amountMicros) / 1_000_000) * MONTHLY_DAYS);
}

/** Lulu's monthly budget to Google's average daily budget, in micros. */
export function monthlyToDailyMicros(monthlyAmount: number): number {
  return Math.round((monthlyAmount / MONTHLY_DAYS) * 1_000_000);
}
