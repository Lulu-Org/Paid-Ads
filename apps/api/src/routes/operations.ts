import {
  idParamSchema,
  syncRunsQuerySchema,
  teamInviteSchema,
  teamMemberUpdateSchema,
  userIdParamSchema,
  type TeamInviteInput,
  type TeamMemberUpdateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { getPaymentMethod, listStatements } from '../services/billing';
import { getOperations, listSyncRuns, reconcile, retryIncident } from '../services/operations';
import { inviteTeammate, listTeam, updateTeamMember } from '../services/team';

// /operations, /team and /billing.
export const operationsRouter = Router();
export const teamRouter = Router();
export const billingRouter = Router();

operationsRouter.get(
  '/',
  requirePermission('integrations', 'view'),
  asyncHandler(async (req, res) => ok(res, await getOperations(requireContext(req)))),
);

operationsRouter.get(
  '/sync-runs',
  requirePermission('integrations', 'view'),
  validate({
    query: syncRunsQuerySchema,
  }),
  asyncHandler(async (req, res) => {
    const query = syncRunsQuerySchema.parse(req.query);
    const result = await listSyncRuns(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

operationsRouter.post(
  '/incidents/:id/retry',
  requirePermission('integrations', 'edit'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await retryIncident(requireContext(req), req.params.id as string)),
  ),
);

operationsRouter.post(
  '/reconcile',
  requirePermission('integrations', 'edit'),
  asyncHandler(async (req, res) => ok(res, await reconcile(requireContext(req)))),
);

teamRouter.get(
  '/',
  requirePermission('settings', 'view'),
  asyncHandler(async (req, res) => ok(res, await listTeam(requireContext(req)))),
);

teamRouter.post(
  '/invitations',
  requirePermission('settings', 'edit'),
  validate({ body: teamInviteSchema }),
  asyncHandler(async (req, res) =>
    created(res, await inviteTeammate(requireContext(req), req.body as TeamInviteInput)),
  ),
);

teamRouter.patch(
  '/:userId',
  requirePermission('settings', 'edit'),
  validate({ params: userIdParamSchema, body: teamMemberUpdateSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateTeamMember(
        requireContext(req),
        req.params.userId as string,
        req.body as TeamMemberUpdateInput,
      ),
    ),
  ),
);

billingRouter.get(
  '/payment-method',
  requirePermission('billing', 'view'),
  asyncHandler(async (req, res) => ok(res, await getPaymentMethod(requireContext(req)))),
);

billingRouter.get(
  '/statements',
  requirePermission('billing', 'view'),
  asyncHandler(async (req, res) => ok(res, await listStatements(requireContext(req)))),
);
