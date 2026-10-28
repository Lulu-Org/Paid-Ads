import { auditListQuerySchema, type AuditListQuery } from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { listAudit } from '../services/audit';

// GET /audit-log (docs/api.md, "Audit log"). Mounted after requireAuth. Reading who changed what is
// an admin task: it needs settings: edit (owners and admins by default).
export const auditRouter = Router();

auditRouter.get(
  '/',
  requirePermission('settings', 'edit'),
  validate({ query: auditListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as AuditListQuery;
    const result = await listAudit(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);
