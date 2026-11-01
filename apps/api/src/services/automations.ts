import type {
  AutomationActivity,
  AutomationRule,
  AutomationRuleCreateInput,
  AutomationRuleUpdateInput,
  LibraryApiQuery,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import { libraryOrderBy } from '../lib/libraryQuery';
import type { RequestContext } from '../middleware/requestContext';
import {
  Prisma,
  type AutomationActivity as ActivityRow,
  type AutomationRule as RuleRow,
} from '../generated/prisma/client';

// Automation rules and what they did (docs/api.md). These endpoints only store rules. The worker
// that evaluates them must create an ApprovalRequest instead of acting for `shift_budget`.

const iso = (value: Date) => value.toISOString();

function toRuleDto(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : iso(row.deletedAt),
    name: row.name,
    trigger: row.trigger as AutomationRule['trigger'],
    condition: row.condition as AutomationRule['condition'],
    action: row.action as AutomationRule['action'],
    enabled: row.enabled,
  };
}

function toActivityDto(row: ActivityRow): AutomationActivity {
  return {
    id: row.id,
    ruleId: row.ruleId,
    outcome: row.outcome as AutomationActivity['outcome'],
    campaignId: row.campaignId,
    at: iso(row.at),
  };
}

async function findRule(workspaceId: string, ruleId: string): Promise<RuleRow> {
  const row = await scopedDb(workspaceId).automationRule.findFirst({ where: { id: ruleId } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

export async function listAutomationRules(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<{ items: AutomationRule[]; total: number }> {
  const where: Prisma.AutomationRuleWhereInput = {};
  if (query.q !== undefined) where.name = { contains: query.q, mode: 'insensitive' };
  const rules = scopedDb(ctx.workspaceId).automationRule;
  const [rows, total] = await Promise.all([
    rules.findMany({
      where,
      orderBy: libraryOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    rules.count({ where }),
  ]);
  return { total, items: rows.map(toRuleDto) };
}

export async function createAutomationRule(
  ctx: RequestContext,
  input: AutomationRuleCreateInput,
): Promise<AutomationRule> {
  const row = await scopedDb(ctx.workspaceId).automationRule.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      trigger: input.trigger,
      condition: input.condition === null ? Prisma.JsonNull : input.condition,
      action: input.action,
      enabled: input.enabled,
    },
  });
  return toRuleDto(row);
}

export async function updateAutomationRule(
  ctx: RequestContext,
  ruleId: string,
  input: AutomationRuleUpdateInput,
): Promise<AutomationRule> {
  await findRule(ctx.workspaceId, ruleId);
  const data: Prisma.AutomationRuleUncheckedUpdateInput = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
    ...(input.condition === undefined
      ? {}
      : { condition: input.condition === null ? Prisma.JsonNull : input.condition }),
    ...(input.action === undefined ? {} : { action: input.action }),
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
  };
  const row = await scopedDb(ctx.workspaceId).automationRule.update({
    where: { id: ruleId },
    data,
  });
  return toRuleDto(row);
}

export async function deleteAutomationRule(ctx: RequestContext, ruleId: string): Promise<void> {
  await findRule(ctx.workspaceId, ruleId);
  await scopedDb(ctx.workspaceId).automationRule.delete({ where: { id: ruleId } });
}

export async function listAutomationActivity(
  ctx: RequestContext,
  query: LibraryApiQuery,
): Promise<{ items: AutomationActivity[]; total: number }> {
  const activities = scopedDb(ctx.workspaceId).automationActivity;
  const [rows, total] = await Promise.all([
    activities.findMany({
      orderBy: { at: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    activities.count(),
  ]);
  return { total, items: rows.map(toActivityDto) };
}
