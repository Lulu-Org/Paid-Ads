import { overviewQuerySchema, type OverviewQuery } from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { getOverview } from '../services/overview';

// GET /overview (docs/api.md "Overview, planning and reports"). Mounted after requireAuth.
export const overviewRouter = Router();

overviewRouter.get(
  '/',
  requirePermission('campaigns', 'view'),
  validate({ query: overviewQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as OverviewQuery;
    return ok(res, await getOverview(requireContext(req), query));
  }),
);
