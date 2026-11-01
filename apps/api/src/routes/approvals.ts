import {
  approvalInboxQuerySchema,
  idParamSchema,
  approvalRequestCreateSchema,
  type ApprovalInboxQuery,
  type ApprovalRequestCreateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  approveApproval,
  createApproval,
  listApprovals,
  rejectApproval,
} from '../services/approvals';

// Approval requests at /approvals.
export const approvalsRouter = Router();

approvalsRouter.get(
  '/',
  requirePermission('billing', 'view'),
  validate({ query: approvalInboxQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ApprovalInboxQuery;
    const result = await listApprovals(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

approvalsRouter.post(
  '/',
  requirePermission('campaigns', 'edit'),
  validate({ body: approvalRequestCreateSchema }),
  asyncHandler(async (req, res) => {
    const result = await createApproval(
      requireContext(req),
      req.body as ApprovalRequestCreateInput,
    );
    return result.existing ? ok(res, result.approval) : created(res, result.approval);
  }),
);

approvalsRouter.post(
  '/:id/approve',
  requirePermission('billing', 'approve'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await approveApproval(requireContext(req), req.params.id as string));
  }),
);

approvalsRouter.post(
  '/:id/reject',
  requirePermission('billing', 'approve'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await rejectApproval(requireContext(req), req.params.id as string));
  }),
);
