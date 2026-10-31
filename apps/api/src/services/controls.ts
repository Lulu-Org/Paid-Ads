import type { ApprovalPolicy, SpendLimit, SpendLimitUpdateInput } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { loadApprovalPolicy } from './campaigns';

// Spend limit and approval policy (docs/api.md "Automations, billing, approvals, team, operations").

const ALERT_STEPS = [0.7, 0.8, 0.9];
const DEFAULT_CURRENCY = 'EUR';
const round2 = (value: number) => Math.round(value * 100) / 100;

// "This month" is the month of the newest synced metric day, like the Overview's "today".
async function usedThisMonth(workspaceId: string, currency: string) {
  const scoped = scopedDb(workspaceId);
  const newest = await scoped.campaignMetricDay.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  const ref = newest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const sum = await scoped.campaignMetricDay.aggregate({
    _sum: { spendAmount: true },
    where: { date: { gte: start, lt: end }, currency },
  });
  return { amount: round2(sum._sum.spendAmount?.toNumber() ?? 0), currency };
}

export async function getSpendLimit(ctx: RequestContext): Promise<SpendLimit> {
  const row = await scopedDb(ctx.workspaceId).spendLimit.findFirst();
  if (row === null) {
    return {
      monthly: { amount: 0, currency: DEFAULT_CURRENCY },
      alertAt: 0.8,
      notifyBeforeLimit: false,
      used: await usedThisMonth(ctx.workspaceId, DEFAULT_CURRENCY),
    };
  }
  return {
    monthly: { amount: row.monthlyAmount.toNumber(), currency: row.currency },
    alertAt: row.alertAt,
    notifyBeforeLimit: row.notifyBeforeLimit,
    used: await usedThisMonth(ctx.workspaceId, row.currency),
  };
}

export async function updateSpendLimit(
  ctx: RequestContext,
  input: SpendLimitUpdateInput,
): Promise<SpendLimit> {
  if (!ALERT_STEPS.includes(input.alertAt)) {
    throw AppError.validation([
      {
        path: 'alertAt',
        code: 'invalid_alert_share',
        message: 'errors.validation.invalid_alert_share',
      },
    ]);
  }
  const scoped = scopedDb(ctx.workspaceId);
  const data = {
    monthlyAmount: input.monthly.amount,
    currency: input.monthly.currency,
    alertAt: input.alertAt,
    notifyBeforeLimit: input.notifyBeforeLimit,
  };
  const existing = await scoped.spendLimit.findFirst();
  if (existing === null) {
    await scoped.spendLimit.create({ data: { workspaceId: ctx.workspaceId, ...data } });
  } else {
    await scoped.spendLimit.update({ where: { id: existing.id }, data });
  }
  return getSpendLimit(ctx);
}

export function getApprovalPolicy(ctx: RequestContext): Promise<ApprovalPolicy> {
  return loadApprovalPolicy(ctx.workspaceId);
}

export async function updateApprovalPolicy(
  ctx: RequestContext,
  input: ApprovalPolicy,
): Promise<ApprovalPolicy> {
  const scoped = scopedDb(ctx.workspaceId);
  const data = {
    scope: input.scope,
    thresholdAmount: input.threshold.amount,
    currency: input.threshold.currency,
    approverRole: input.approverRole,
  };
  const existing = await scoped.approvalPolicy.findFirst();
  if (existing === null) {
    await scoped.approvalPolicy.create({ data: { workspaceId: ctx.workspaceId, ...data } });
  } else {
    await scoped.approvalPolicy.update({ where: { id: existing.id }, data });
  }
  return loadApprovalPolicy(ctx.workspaceId);
}