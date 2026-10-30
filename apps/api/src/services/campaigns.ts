import {
  approvalPolicySchema,
  campaignDefaultsSchema,
  campaignTotals,
  launchChecklist,
  needsBudgetApproval,
  needsLaunchApproval,
  type AdAccount,
  type ApprovalPolicy,
  type ApprovalRequest,
  type Audience,
  type Campaign,
  type CampaignChecklist,
  type CampaignCreateInput,
  type CampaignDetail,
  type CampaignListItem,
  type CampaignListQuery,
  type CampaignMetricDay,
  type CampaignPlan,
  type CampaignPlanStep,
  type CampaignPlanUpdateInput,
  type CampaignTotals,
  type CampaignUpdateInput,
  type Creative,
  type Money,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb } from '../db/scoped';
import { enqueueAdsPush } from '../jobs/queues';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import type {
  AdAccount as AdAccountRow,
  ApprovalRequest as ApprovalRequestRow,
  Audience as AudienceRow,
  Campaign as CampaignRow,
  CampaignMetricDay as CampaignMetricDayRow,
  CampaignPlanStep as CampaignPlanStepRow,
  Creative as CreativeRow,
  Prisma,
} from '../generated/prisma/client';

// Campaigns and their metrics, plan, launch checklist and approvals (docs/api.md "Campaigns").
// All reads and writes go through scopedDb so the workspace filter and soft deletes always apply.

const DEFAULT_CAMPAIGN_DEFAULTS = {
  consentRequired: true,
  autoTagLinks: true,
  policyValidation: true,
};

const NO_APPROVAL_POLICY: ApprovalPolicy = {
  scope: 'none',
  threshold: { amount: 0, currency: 'EUR' },
  approverRole: 'reviewer',
};

const iso = (value: Date) => value.toISOString();
const isoDay = (value: Date) => value.toISOString().slice(0, 10);
const money = (amount: { toNumber(): number }, currency: string): Money => ({
  amount: amount.toNumber(),
  currency,
});

// ---------- Mapping helpers ----------

export function toCampaignDto(row: CampaignRow): Campaign {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    adAccountId: row.adAccountId,
    platform: row.platform,
    externalId: row.externalId,
    name: row.name,
    status: row.status,
    objective: row.objective,
    audienceSummary: row.audienceSummary,
    startAt: row.startAt === null ? null : iso(row.startAt),
    endAt: row.endAt === null ? null : iso(row.endAt),
    budget: money(row.budgetAmount, row.budgetCurrency),
    rationale: row.rationale,
    nextStep: row.nextStep,
    ownerId: row.ownerId,
  };
}

export function toCampaignMetricDayDto(row: CampaignMetricDayRow): CampaignMetricDay {
  return {
    date: isoDay(row.date),
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    leads: row.leads,
    spend: money(row.spendAmount, row.currency),
    revenue: money(row.revenueAmount, row.currency),
  };
}

export function toCampaignPlanStepDto(row: CampaignPlanStepRow): CampaignPlanStep {
  return {
    id: row.id,
    order: row.order,
    label: row.label,
    detail: row.detail,
    status: row.status,
  };
}

export function toAdAccountDto(row: AdAccountRow): AdAccount {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    platform: row.platform,
    externalId: row.externalId,
    name: row.name,
    currency: row.currency,
    status: row.status,
    scopes: row.scopes,
    lastSyncAt: row.lastSyncAt === null ? null : iso(row.lastSyncAt),
    lastError: row.lastError,
  };
}

function toAudienceDto(row: AudienceRow): Audience {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    source: row.source as Audience['source'],
    sizeEstimate: row.sizeEstimate,
    consentBasis: row.consentBasis,
    platforms: row.platforms,
    lastSyncedAt: row.lastSyncedAt === null ? null : iso(row.lastSyncedAt),
  };
}

function toCreativeDto(row: CreativeRow): Creative {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    type: row.type as Creative['type'],
    fileUrl: row.fileUrl,
    meta: (row.meta ?? {}) as Record<string, string | number>,
    approvalStatus: row.approvalStatus,
    approvedById: row.approvedById,
  };
}

export function toApprovalRequestDto(row: ApprovalRequestRow): ApprovalRequest {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    kind: row.kind as ApprovalRequest['kind'],
    campaignId: row.campaignId,
    payload: row.payload as Record<string, unknown>,
    status: row.status,
    requestedById: row.requestedById,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt === null ? null : iso(row.decidedAt),
  };
}

// ---------- Loaders ----------

async function findCampaign(workspaceId: string, campaignId: string): Promise<CampaignRow> {
  const row = await scopedDb(workspaceId).campaign.findFirst({ where: { id: campaignId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

async function loadMetricDayRows(
  workspaceId: string,
  campaignIds: string[],
): Promise<CampaignMetricDayRow[]> {
  if (campaignIds.length === 0) return [];
  return scopedDb(workspaceId).campaignMetricDay.findMany({
    where: { campaignId: { in: campaignIds } },
    orderBy: { date: 'asc' },
  });
}

function groupDays(rows: CampaignMetricDayRow[]): Map<string, CampaignMetricDayRow[]> {
  const byCampaign = new Map<string, CampaignMetricDayRow[]>();
  for (const row of rows) {
    const list = byCampaign.get(row.campaignId) ?? [];
    list.push(row);
    byCampaign.set(row.campaignId, list);
  }
  return byCampaign;
}

function totalsFor(row: CampaignRow, days: CampaignMetricDayRow[]): CampaignTotals {
  return campaignTotals(
    days.map(toCampaignMetricDayDto),
    money(row.budgetAmount, row.budgetCurrency),
  );
}

export function loadCampaignTotals(
  workspaceId: string,
  campaigns: CampaignRow[],
): Promise<Map<string, CampaignTotals>> {
  return loadMetricDayRows(
    workspaceId,
    campaigns.map((campaign) => campaign.id),
  ).then((rows) => {
    const byCampaign = groupDays(rows);
    return new Map(
      campaigns.map((campaign) => [
        campaign.id,
        totalsFor(campaign, byCampaign.get(campaign.id) ?? []),
      ]),
    );
  });
}

export async function loadCampaignDefaults(workspaceId: string) {
  const row = await scopedDb(workspaceId).setting.findFirst({ where: { key: 'campaignDefaults' } });
  if (row === null) return DEFAULT_CAMPAIGN_DEFAULTS;
  const parsed = campaignDefaultsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_CAMPAIGN_DEFAULTS;
}

export async function loadApprovalPolicy(workspaceId: string): Promise<ApprovalPolicy> {
  const row = await scopedDb(workspaceId).approvalPolicy.findFirst();
  if (row === null) return NO_APPROVAL_POLICY;
  const parsed = approvalPolicySchema.safeParse({
    scope: row.scope,
    threshold: money(row.thresholdAmount, row.currency),
    approverRole: row.approverRole,
  });
  return parsed.success ? parsed.data : NO_APPROVAL_POLICY;
}

export async function hasHealthyTracking(workspaceId: string): Promise<boolean> {
  const row = await scopedDb(workspaceId).conversionEvent.findFirst({
    where: { health: 'mapped' },
  });
  return row !== null;
}

export async function loadOpenApprovalRequest(
  workspaceId: string,
  campaignId: string,
  kind: ApprovalRequest['kind'],
): Promise<ApprovalRequestRow | null> {
  return scopedDb(workspaceId).approvalRequest.findFirst({
    where: { campaignId, kind, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
}

async function validateAdAccount(
  workspaceId: string,
  adAccountId: string,
  platform: Campaign['platform'],
): Promise<void> {
  const account = await scopedDb(workspaceId).adAccount.findFirst({ where: { id: adAccountId } });
  if (account === null || account.platform !== platform) {
    throw AppError.validation([
      {
        path: 'adAccountId',
        code: 'invalid_ad_account',
        message: 'errors.validation.invalid_ad_account',
      },
    ]);
  }
}

async function resolveOwner(
  workspaceId: string,
  ownerId: string | undefined,
  fallbackUserId: string,
): Promise<string> {
  if (ownerId === undefined) return fallbackUserId;
  const user = await scopedDb(workspaceId).user.findFirst({ where: { id: ownerId } });
  if (user === null) {
    throw AppError.validation([
      { path: 'ownerId', code: 'invalid_owner', message: 'errors.validation.invalid_owner' },
    ]);
  }
  return user.id;
}

// ---------- List and detail ----------

function campaignOrderBy(sort: CampaignListQuery['sort']): Prisma.CampaignOrderByWithRelationInput {
  switch (sort) {
    case '-name':
      return { name: 'desc' };
    case 'createdAt':
      return { createdAt: 'asc' };
    case '-createdAt':
      return { createdAt: 'desc' };
    case 'startAt':
      return { startAt: 'asc' };
    case '-startAt':
      return { startAt: 'desc' };
    case 'budget':
      return { budgetAmount: 'asc' };
    case '-budget':
      return { budgetAmount: 'desc' };
    default:
      return { name: 'asc' };
  }
}

export interface CampaignListResult {
  items: CampaignListItem[];
  total: number;
}

export async function listCampaigns(
  ctx: RequestContext,
  query: CampaignListQuery,
): Promise<CampaignListResult> {
  const where: Prisma.CampaignWhereInput = {};
  if (query.platform !== undefined) where.platform = query.platform;
  if (query.status !== undefined) where.status = query.status;
  if (query.q !== undefined) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { objective: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const campaigns = scopedDb(ctx.workspaceId).campaign;
  const [rows, total] = await Promise.all([
    campaigns.findMany({
      where,
      orderBy: campaignOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    campaigns.count({ where }),
  ]);

  const totals = await loadCampaignTotals(ctx.workspaceId, rows);
  return {
    total,
    items: rows.map((row) => ({ ...toCampaignDto(row), totals: totals.get(row.id)! })),
  };
}

export async function getCampaign(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignDetail> {
  const row = await findCampaign(ctx.workspaceId, campaignId);
  const scoped = scopedDb(ctx.workspaceId);
  const [dayRows, planRows, links] = await Promise.all([
    loadMetricDayRows(ctx.workspaceId, [campaignId]),
    scoped.campaignPlanStep.findMany({ where: { campaignId }, orderBy: { order: 'asc' } }),
    scoped.campaignCreative.findMany({ where: { campaignId } }),
  ]);

  return {
    ...toCampaignDto(row),
    totals: totalsFor(row, dayRows),
    plan: planRows.map(toCampaignPlanStepDto),
    creativeIds: links.map((link) => link.creativeId),
    days: dayRows.map(toCampaignMetricDayDto),
  };
}

// ---------- Create and update ----------

export async function createCampaign(
  ctx: RequestContext,
  input: CampaignCreateInput,
): Promise<Campaign> {
  if (input.adAccountId !== undefined && input.adAccountId !== null) {
    await validateAdAccount(ctx.workspaceId, input.adAccountId, input.platform);
  }
  const ownerId = await resolveOwner(ctx.workspaceId, input.ownerId, ctx.userId);

  const data: Prisma.CampaignUncheckedCreateInput = {
    workspaceId: ctx.workspaceId,
    platform: input.platform,
    adAccountId: input.adAccountId ?? null,
    externalId: null,
    name: input.name,
    status: 'draft',
    objective: input.objective,
    budgetAmount: input.budget.amount,
    budgetCurrency: input.budget.currency,
    ownerId,
    ...(input.audienceSummary === undefined ? {} : { audienceSummary: input.audienceSummary }),
    ...(input.startAt === undefined
      ? {}
      : { startAt: input.startAt === null ? null : new Date(input.startAt) }),
    ...(input.endAt === undefined
      ? {}
      : { endAt: input.endAt === null ? null : new Date(input.endAt) }),
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    ...(input.nextStep === undefined ? {} : { nextStep: input.nextStep }),
  };
  const row = await scopedDb(ctx.workspaceId).campaign.create({ data });
  return toCampaignDto(row);
}

export type CampaignUpdateResult =
  | { campaign: Campaign; approval?: undefined }
  | { approval: ApprovalRequest; campaign?: undefined };

export async function updateCampaign(
  ctx: RequestContext,
  campaignId: string,
  input: CampaignUpdateInput,
): Promise<CampaignUpdateResult> {
  const campaign = await findCampaign(ctx.workspaceId, campaignId);

  if (input.adAccountId !== undefined && input.adAccountId !== null) {
    await validateAdAccount(ctx.workspaceId, input.adAccountId, campaign.platform);
  }
  const ownerId =
    input.ownerId === undefined
      ? undefined
      : await resolveOwner(ctx.workspaceId, input.ownerId, ctx.userId);

  if (input.budget !== undefined) {
    const policy = await loadApprovalPolicy(ctx.workspaceId);
    const current = money(campaign.budgetAmount, campaign.budgetCurrency);
    if (needsBudgetApproval(current, input.budget, policy)) {
      const scoped = scopedDb(ctx.workspaceId);
      const existing = await loadOpenApprovalRequest(ctx.workspaceId, campaignId, 'budget_change');
      const approval =
        existing ??
        (await scoped.approvalRequest.create({
          data: {
            workspaceId: ctx.workspaceId,
            kind: 'budget_change',
            campaignId,
            payload: { budget: input.budget },
            requestedById: ctx.userId,
          },
        }));
      return { approval: toApprovalRequestDto(approval) };
    }
  }

  const data: Prisma.CampaignUncheckedUpdateInput = {
    ...(input.adAccountId === undefined ? {} : { adAccountId: input.adAccountId }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.objective === undefined ? {} : { objective: input.objective }),
    ...(input.audienceSummary === undefined ? {} : { audienceSummary: input.audienceSummary }),
    ...(input.startAt === undefined
      ? {}
      : { startAt: input.startAt === null ? null : new Date(input.startAt) }),
    ...(input.endAt === undefined
      ? {}
      : { endAt: input.endAt === null ? null : new Date(input.endAt) }),
    ...(input.budget === undefined
      ? {}
      : {
          budgetAmount: input.budget.amount,
          budgetCurrency: input.budget.currency,
        }),
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    ...(input.nextStep === undefined ? {} : { nextStep: input.nextStep }),
    ...(ownerId === undefined ? {} : { ownerId }),
  };
  const row = await scopedDb(ctx.workspaceId).campaign.update({
    where: { id: campaignId },
    data,
  });
  return { campaign: toCampaignDto(row) };
}

// ---------- Plan ----------

export async function getCampaignPlan(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignPlan> {
  await findCampaign(ctx.workspaceId, campaignId);
  const rows = await scopedDb(ctx.workspaceId).campaignPlanStep.findMany({
    where: { campaignId },
    orderBy: { order: 'asc' },
  });
  return { steps: rows.map(toCampaignPlanStepDto) };
}

export async function replaceCampaignPlan(
  ctx: RequestContext,
  campaignId: string,
  input: CampaignPlanUpdateInput,
): Promise<CampaignPlan> {
  await findCampaign(ctx.workspaceId, campaignId);

  const rows = await db.$transaction(async (tx) => {
    await tx.campaignPlanStep.updateMany({
      where: { workspaceId: ctx.workspaceId, campaignId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    const created: CampaignPlanStepRow[] = [];
    for (const [order, step] of input.steps.entries()) {
      created.push(
        await tx.campaignPlanStep.create({
          data: {
            workspaceId: ctx.workspaceId,
            campaignId,
            order,
            label: step.label,
            detail: step.detail,
            status: step.status,
          },
        }),
      );
    }
    return created;
  });

  return { steps: rows.map(toCampaignPlanStepDto) };
}

// ---------- Checklist and launch ----------

async function buildChecklist(
  ctx: RequestContext,
  campaign: CampaignRow,
): Promise<CampaignChecklist> {
  const scoped = scopedDb(ctx.workspaceId);
  const [account, links, audienceRows, trackingHealthy, defaults, policy, approvals] =
    await Promise.all([
      campaign.adAccountId === null
        ? Promise.resolve(null)
        : scoped.adAccount.findFirst({ where: { id: campaign.adAccountId } }),
      scoped.campaignCreative.findMany({ where: { campaignId: campaign.id } }),
      scoped.audience.findMany(),
      hasHealthyTracking(ctx.workspaceId),
      loadCampaignDefaults(ctx.workspaceId),
      loadApprovalPolicy(ctx.workspaceId),
      scoped.approvalRequest.findMany({ where: { campaignId: campaign.id } }),
    ]);

  const creativeIds = links.map((link) => link.creativeId);
  const creativeRows =
    creativeIds.length === 0
      ? []
      : await scoped.creative.findMany({ where: { id: { in: creativeIds } } });

  return launchChecklist({
    campaign: toCampaignDto(campaign),
    account: account === null ? null : toAdAccountDto(account),
    creatives: creativeRows.map(toCreativeDto),
    audiences: audienceRows.map(toAudienceDto),
    trackingHealthy,
    defaults,
    policy,
    approvals: approvals.map(toApprovalRequestDto),
  });
}

export async function getCampaignChecklist(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignChecklist> {
  return buildChecklist(ctx, await findCampaign(ctx.workspaceId, campaignId));
}

export type CampaignLaunchResult =
  | { campaign: Campaign; approval?: undefined }
  | { approval: ApprovalRequest; campaign?: undefined };

export async function launchCampaign(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignLaunchResult> {
  const campaign = await findCampaign(ctx.workspaceId, campaignId);
  if (campaign.status !== 'draft') {
    throw AppError.conflict('CONFLICT', { status: campaign.status });
  }

  const scoped = scopedDb(ctx.workspaceId);
  const [checklist, policy, approved] = await Promise.all([
    buildChecklist(ctx, campaign),
    loadApprovalPolicy(ctx.workspaceId),
    scoped.approvalRequest.findFirst({
      where: { campaignId, kind: 'launch', status: 'approved' },
    }),
  ]);

  if (needsLaunchApproval(toCampaignDto(campaign), policy) && approved === null) {
    const existing = await loadOpenApprovalRequest(ctx.workspaceId, campaignId, 'launch');
    const approval =
      existing ??
      (await scoped.approvalRequest.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: 'launch',
          campaignId,
          payload: { budget: money(campaign.budgetAmount, campaign.budgetCurrency) },
          requestedById: ctx.userId,
        },
      }));
    return { approval: toApprovalRequestDto(approval) };
  }

  if (checklist.items.some((item) => !item.passed)) {
    throw AppError.conflict('CONFLICT', { checklist });
  }

  const row = await scoped.campaign.update({
    where: { id: campaignId },
    data: { status: 'live' },
  });
  await enqueueAdsPush({
    workspaceId: ctx.workspaceId,
    campaignId,
    requestedById: ctx.userId,
  });
  return { campaign: toCampaignDto(row) };
}

export type CampaignStatusResult = { campaign: Campaign };

async function changeStatus(
  ctx: RequestContext,
  campaignId: string,
  from: Campaign['status'],
  to: Campaign['status'],
): Promise<CampaignStatusResult> {
  const campaign = await findCampaign(ctx.workspaceId, campaignId);
  if (campaign.status !== from) {
    throw AppError.conflict('CONFLICT', { status: campaign.status });
  }

  const scoped = scopedDb(ctx.workspaceId);
  const row = await scoped.campaign.update({ where: { id: campaignId }, data: { status: to } });
  await enqueueAdsPush({
    workspaceId: ctx.workspaceId,
    campaignId,
    requestedById: ctx.userId,
  });
  return { campaign: toCampaignDto(row) };
}

export function pauseCampaign(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignStatusResult> {
  return changeStatus(ctx, campaignId, 'live', 'paused');
}

export function resumeCampaign(
  ctx: RequestContext,
  campaignId: string,
): Promise<CampaignStatusResult> {
  return changeStatus(ctx, campaignId, 'paused', 'live');
}
