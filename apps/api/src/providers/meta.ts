import type { AdPlatform, BudgetPeriod, Campaign, CampaignStatus, Money } from '@lulu/shared';
import type { MetaGraphClient } from './metaClient';
import type {
  AdsProvider,
  ExchangeCodeResult,
  ExternalAccount,
  ExternalCampaign,
  ExternalMetricDay,
  ProviderAccount,
  PushCampaignResult,
} from './types';

// Live Meta Ads provider (C3). Campaigns and daily insights are read through the Marketing API;
// pushes create a paused campaign (the push worker then applies status and budget) and update status
// and budget of existing ones. Ad sets, ads, audiences and creatives are not part of AdsProvider.

// Meta sends and expects budgets in the currency's minor unit. These ISO currencies have none.
// Check against Meta's currency offset table when the app is available.
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

// account_status 100 = pending closure, 101 = closed.
const CLOSED_ACCOUNT_STATUSES = new Set([100, 101]);

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Lead generation',
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_SALES: 'Sales',
  OUTCOME_APP_PROMOTION: 'App promotion',
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function minorUnitFactor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * minorUnitFactor(currency));
}

export function fromMinorUnits(value: string | number | undefined, currency: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round2(parsed / minorUnitFactor(currency)) : 0;
}

export function mapMetaStatus(value: string | undefined): CampaignStatus {
  switch (value) {
    case 'ACTIVE':
      return 'live';
    case 'ARCHIVED':
    case 'DELETED':
      return 'ended';
    default:
      return 'paused';
  }
}

// Lulu stores the objective as free text; Meta needs one of its outcome-based objectives.
export function metaObjectiveFor(objective: string): string {
  const text = objective.toLowerCase();
  if (text.includes('awareness') || text.includes('reach') || text.includes('brand')) {
    return 'OUTCOME_AWARENESS';
  }
  if (text.includes('traffic') || text.includes('click') || text.includes('visit')) {
    return 'OUTCOME_TRAFFIC';
  }
  if (text.includes('sale') || text.includes('purchase') || text.includes('revenue')) {
    return 'OUTCOME_SALES';
  }
  if (text.includes('engage')) return 'OUTCOME_ENGAGEMENT';
  if (text.includes('app')) return 'OUTCOME_APP_PROMOTION';
  return 'OUTCOME_LEADS';
}

function parseTime(value: string | undefined): Date | null {
  if (value === undefined) return null;
  // Meta sends offsets like +0000; make them ISO 8601 (+00:00) so every runtime parses them.
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date;
}

const actId = (externalId: string) => `act_${externalId.replace(/^act_/, '')}`;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

interface MetaAdAccountRow {
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
}

interface MetaPermissionRow {
  permission?: string;
  status?: string;
}

interface MetaCampaignRow {
  id?: string;
  name?: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface MetaAction {
  action_type?: string;
  value?: string;
}

interface MetaInsightRow {
  campaign_id?: string;
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

function sumAction(list: MetaAction[] | undefined, type: string): number {
  let total = 0;
  for (const item of list ?? []) {
    if (item.action_type === type) {
      const value = Number(item.value);
      if (Number.isFinite(value)) total += value;
    }
  }
  return total;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The subset of the Graph client the provider uses. */
export type MetaClient = Pick<
  MetaGraphClient,
  'authorizeUrl' | 'exchangeCode' | 'get' | 'getAll' | 'post'
>;

export interface MetaAdsProviderOptions {
  client: MetaClient;
  apiPublicUrl: string;
}

export class MetaAdsProvider implements AdsProvider {
  readonly platform: AdPlatform = 'meta_ads';

  private readonly client: MetaClient;
  private readonly apiPublicUrl: string;

  constructor(options: MetaAdsProviderOptions) {
    this.client = options.client;
    this.apiPublicUrl = options.apiPublicUrl.replace(/\/$/, '');
  }

  private redirectUri(): string {
    return `${this.apiPublicUrl}/api/v1/ad-accounts/callback/meta_ads`;
  }

  authorizeUrl(state: string): string {
    return this.client.authorizeUrl(state, this.redirectUri());
  }

  async exchangeCode(code: string): Promise<ExchangeCodeResult> {
    const tokens = await this.client.exchangeCode(code, this.redirectUri());

    const [rows, permissions] = await Promise.all([
      this.client.getAll<MetaAdAccountRow>(tokens.accessToken, '/me/adaccounts', {
        fields: 'account_id,name,currency,account_status',
        limit: '100',
      }),
      this.client.getAll<MetaPermissionRow>(tokens.accessToken, '/me/permissions'),
    ]);

    const scopes = permissions.flatMap((row) =>
      row.status === 'granted' && row.permission !== undefined ? [row.permission] : [],
    );
    const accounts: ExternalAccount[] = [];
    for (const row of rows) {
      if (row.account_id === undefined) continue;
      if (row.account_status !== undefined && CLOSED_ACCOUNT_STATUSES.has(row.account_status)) {
        continue;
      }
      accounts.push({
        externalId: row.account_id,
        name: row.name ?? `Meta ad account ${row.account_id}`,
        currency: row.currency ?? 'EUR',
        scopes,
      });
    }

    return { token: tokens.accessToken, expiresAt: tokens.expiresAt, accounts };
  }

  async listCampaigns(account: ProviderAccount): Promise<ExternalCampaign[]> {
    const rows = await this.client.getAll<MetaCampaignRow>(
      account.token,
      `/${actId(account.externalId)}/campaigns`,
      {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
        limit: '100',
      },
    );

    const campaigns: ExternalCampaign[] = [];
    for (const row of rows) {
      if (row.id === undefined) continue;
      // A campaign without a campaign-level budget keeps its budget on its ad sets, which
      // AdsProvider does not model; it syncs with a zero daily budget.
      const lifetime = row.daily_budget === undefined && row.lifetime_budget !== undefined;
      campaigns.push({
        externalId: row.id,
        name: row.name ?? `Meta campaign ${row.id}`,
        status: mapMetaStatus(row.status),
        objective:
          row.objective === undefined
            ? 'Meta campaign'
            : (OBJECTIVE_LABELS[row.objective] ?? row.objective),
        audienceSummary: null,
        startAt: parseTime(row.start_time),
        endAt: parseTime(row.stop_time),
        budget: {
          amount: fromMinorUnits(
            lifetime ? row.lifetime_budget : row.daily_budget,
            account.currency,
          ),
          currency: account.currency,
        },
        budgetPeriod: lifetime ? 'total' : 'daily',
      });
    }
    return campaigns;
  }

  async metrics(account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]> {
    const rows = await this.client.getAll<MetaInsightRow>(
      account.token,
      `/${actId(account.externalId)}/insights`,
      {
        level: 'campaign',
        time_increment: '1',
        time_range: JSON.stringify({
          since: isoDay(startOfUtcDay(from)),
          until: isoDay(startOfUtcDay(to)),
        }),
        fields: 'campaign_id,impressions,clicks,spend,actions,action_values',
        limit: '500',
      },
    );

    const days: ExternalMetricDay[] = [];
    for (const row of rows) {
      if (row.campaign_id === undefined || row.date_start === undefined) continue;
      const date = new Date(`${row.date_start}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) continue;

      const leads = sumAction(row.actions, 'lead');
      // omni_purchase already includes the pixel and app purchases, so it is preferred to purchase.
      const purchaseType =
        sumAction(row.actions, 'omni_purchase') > 0 ? 'omni_purchase' : 'purchase';
      days.push({
        externalId: row.campaign_id,
        date,
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
        conversions: leads + sumAction(row.actions, purchaseType),
        leads,
        calls: 0,
        // Insights report spend and values in the account currency's main unit.
        spend: { amount: round2(toNumber(row.spend)), currency: account.currency },
        revenue: {
          amount: round2(sumAction(row.action_values, purchaseType)),
          currency: account.currency,
        },
      });
    }
    return days.sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.externalId.localeCompare(b.externalId),
    );
  }

  async pushCampaign(account: ProviderAccount, campaign: Campaign): Promise<PushCampaignResult> {
    const created = await this.client.post<{ id?: string }>(
      account.token,
      `/${actId(account.externalId)}/campaigns`,
      {
        name: campaign.name,
        objective: metaObjectiveFor(campaign.objective),
        // Always created paused: the push worker applies the Lulu status and budget afterwards.
        status: 'PAUSED',
        special_ad_categories: '[]',
      },
    );
    if (created.id === undefined) {
      throw new Error('Meta did not return an id for the new campaign');
    }
    return { externalId: created.id };
  }

  async setStatus(
    account: ProviderAccount,
    externalId: string,
    status: 'live' | 'paused',
  ): Promise<void> {
    await this.client.post(account.token, `/${externalId}`, {
      status: status === 'live' ? 'ACTIVE' : 'PAUSED',
    });
  }

  async setBudget(
    account: ProviderAccount,
    externalId: string,
    budget: Money,
    budgetPeriod: BudgetPeriod,
  ): Promise<void> {
    // Meta holds a daily budget or a lifetime budget; a monthly amount has no equivalent.
    if (budgetPeriod === 'monthly') {
      throw new Error('Meta Ads budgets are daily or a total for the whole campaign, not monthly');
    }
    if (budget.currency !== account.currency) {
      throw new Error(
        `Budget currency ${budget.currency} does not match the Meta ad account currency ${account.currency}`,
      );
    }
    const minor = String(toMinorUnits(budget.amount, account.currency));
    await this.client.post(account.token, `/${externalId}`, {
      [budgetPeriod === 'daily' ? 'daily_budget' : 'lifetime_budget']: minor,
    });
  }
}
