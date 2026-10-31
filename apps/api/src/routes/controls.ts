import {
  approvalPolicySchema,
  spendLimitUpdateSchema,
  type ApprovalPolicy,
  type SpendLimitUpdateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  getApprovalPolicy,
  getSpendLimit,
  updateApprovalPolicy,
  updateSpendLimit,
} from '../services/controls';

// /spend-limit and /approval-policy (billing view / edit).
export const spendLimitRouter = Router();
export const approvalPolicyRouter = Router();

spendLimitRouter.get(
  '/',
  requirePermission('billing', 'view'),
  asyncHandler(async (req, res) => ok(res, await getSpendLimit(requireContext(req)))),
);

spendLimitRouter.put(
  '/',
  requirePermission('billing', 'edit'),
  validate({ body: spendLimitUpdateSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await updateSpendLimit(requireContext(req), req.body as SpendLimitUpdateInput)),
  ),
);

approvalPolicyRouter.get(
  '/',
  requirePermission('billing', 'view'),
  asyncHandler(async (req, res) => ok(res, await getApprovalPolicy(requireContext(req)))),
);

approvalPolicyRouter.put(
  '/',
  requirePermission('billing', 'edit'),
  validate({ body: approvalPolicySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await updateApprovalPolicy(requireContext(req), req.body as ApprovalPolicy)),
  ),
);