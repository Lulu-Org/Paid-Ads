import {
  moneySchema,
  type ApprovalRequestCreateInput,
  type ApprovalInboxQuery,
  type ApprovalRequest,
} from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { enqueueAdsPush } from '../jobs/queues';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import type { Prisma } from '../generated/prisma/client';
import { loadOpenApprovalRequest, toApprovalRequestDto } from './campaigns';

// Approval requests (docs/api.md). A person cannot decide their own request.

async function findRequest(workspaceId: string, id: string) {
  const row = await scopedDb(workspaceId).approvalRequest.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound('NOT_FOUND');
  return row;
}

export async function listApprovals(
  ctx: RequestContext,
  query: ApprovalInboxQuery,
): Promise<{ items: ApprovalRequest[]; total: number }> {
  const where: Prisma.ApprovalRequestWhereInput = {};
  const options = query as unknown as {
    page: number;
    pageSize: number;
    status?: Prisma.ApprovalRequestWhereInput['status'];
  };
  if (options.status !== undefined) where.status = options.status;
  const approvals = scopedDb(ctx.workspaceId).approvalRequest;
  const [rows, total] = await Promise.all([
    approvals.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    approvals.count({ where }),
  ]);
  return { total, items: rows.map(toApprovalRequestDto) };
}

// An open request for the same kind and campaign is returned instead of a second one.
export async function createApproval(
  ctx: RequestContext,
  input: ApprovalRequestCreateInput,
): Promise<{ approval: ApprovalRequest; existing: boolean }> {
  const approvalInput = input as {
    campaignId: string;
    kind: ApprovalRequest['kind'];
    payload: unknown;
  };
  const scoped = scopedDb(ctx.workspaceId);
  const campaign = await scoped.campaign.findFirst({ where: { id: approvalInput.campaignId } });
  if (campaign === null) {
    throw AppError.validation([
      {
        path: 'campaignId',
        code: 'invalid_campaign',
        message: 'errors.validation.invalid_campaign',
      },
    ]);
  }
  const open = await loadOpenApprovalRequest(
    ctx.workspaceId,
    approvalInput.campaignId,
    approvalInput.kind,
  );
  if (open !== null) return { approval: toApprovalRequestDto(open), existing: true };

  const row = await scoped.approvalRequest.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind: approvalInput.kind,
      campaignId: approvalInput.campaignId,
      payload: approvalInput.payload as Prisma.InputJsonValue,
      requestedById: ctx.userId,
    },
  });
  return { approval: toApprovalRequestDto(row), existing: false };
}

async function decide(
  ctx: RequestContext,
  id: string,
  status: 'approved' | 'rejected',
): Promise<ApprovalRequest> {
  const request = await findRequest(ctx.workspaceId, id);
  if (request.requestedById === ctx.userId) throw AppError.forbidden();
  if (request.status !== 'pending') {
    throw AppError.conflict('CONFLICT', { status: request.status });
  }

  const scoped = scopedDb(ctx.workspaceId);
  const row = await scoped.approvalRequest.update({
    where: { id },
    data: { status, decidedById: ctx.userId, decidedAt: new Date() },
  });

  if (status === 'approved') await applyApproval(ctx, row);
  return toApprovalRequestDto(row);
}

// A launch approval needs no action here: POST /campaigns/:id/launch finds it and proceeds.
async function applyApproval(
  ctx: RequestContext,
  request: Awaited<ReturnType<typeof findRequest>>,
): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  const payload = request.payload as Record<string, unknown>;

  if (request.kind === 'budget_change' && request.campaignId !== null) {
    const budget = moneySchema.safeParse(payload.budget);
    if (!budget.success) return;
    await scoped.campaign.update({
      where: { id: request.campaignId },
      data: { budgetAmount: budget.data.amount, budgetCurrency: budget.data.currency },
    });
    await enqueueAdsPush({
      workspaceId: ctx.workspaceId,
      campaignId: request.campaignId,
      requestedById: request.requestedById,
    });
  }

  if (request.kind === 'creative' && typeof payload.creativeId === 'string') {
    await scoped.creative.updateMany({
      where: { id: payload.creativeId },
      data: { approvalStatus: 'approved', approvedById: ctx.userId },
    });
  }
}

export const approveApproval = (ctx: RequestContext, id: string) => decide(ctx, id, 'approved');
export const rejectApproval = (ctx: RequestContext, id: string) => decide(ctx, id, 'rejected');
