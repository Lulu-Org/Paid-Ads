import {
  automationRuleCreateSchema,
  automationRuleUpdateSchema,
  idParamSchema,
  libraryApiQuerySchema,
  type AutomationRuleCreateInput,
  type AutomationRuleUpdateInput,
  type LibraryApiQuery,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationActivity,
  listAutomationRules,
  updateAutomationRule,
} from '../services/automations';

// Rules at /automations, what they did at /automations/activity.
export const automationsRouter = Router();

automationsRouter.get(
  '/',
  requirePermission('automations', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listAutomationRules(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

automationsRouter.get(
  '/activity',
  requirePermission('automations', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listAutomationActivity(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

automationsRouter.post(
  '/',
  requirePermission('automations', 'create'),
  validate({ body: automationRuleCreateSchema }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await createAutomationRule(requireContext(req), req.body as AutomationRuleCreateInput),
    ),
  ),
);

automationsRouter.patch(
  '/:id',
  requirePermission('automations', 'edit'),
  validate({ params: idParamSchema, body: automationRuleUpdateSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateAutomationRule(
        requireContext(req),
        req.params.id as string,
        req.body as AutomationRuleUpdateInput,
      ),
    ),
  ),
);

automationsRouter.delete(
  '/:id',
  requirePermission('automations', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteAutomationRule(requireContext(req), req.params.id as string);
    return noContent(res);
  }),
);
