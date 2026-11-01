import {
  attributionQuerySchema,
  conversionEventCreateSchema,
  conversionEventUpdateSchema,
  idParamSchema,
  libraryApiQuerySchema,
  type AttributionQuery,
  type ConversionEventCreateInput,
  type ConversionEventUpdateInput,
  type LibraryApiQuery,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createConversionEvent,
  deleteConversionEvent,
  getAttribution,
  getTrackingHealth,
  listConversionEvents,
  updateConversionEvent,
} from '../services/tracking';

export const conversionEventsRouter = Router();
export const trackingRouter = Router();
export const attributionRouter = Router();

conversionEventsRouter.get(
  '/',
  requirePermission('tracking', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listConversionEvents(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

conversionEventsRouter.post(
  '/',
  requirePermission('tracking', 'create'),
  validate({ body: conversionEventCreateSchema }),
  asyncHandler(async (req, res) => {
    const event = await createConversionEvent(
      requireContext(req),
      req.body as ConversionEventCreateInput,
    );
    return created(res, event);
  }),
);

conversionEventsRouter.patch(
  '/:id',
  requirePermission('tracking', 'edit'),
  validate({ params: idParamSchema, body: conversionEventUpdateSchema }),
  asyncHandler(async (req, res) => {
    const event = await updateConversionEvent(
      requireContext(req),
      req.params.id as string,
      req.body as ConversionEventUpdateInput,
    );
    return ok(res, event);
  }),
);

conversionEventsRouter.delete(
  '/:id',
  requirePermission('tracking', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteConversionEvent(requireContext(req), req.params.id as string);
    return noContent(res);
  }),
);

trackingRouter.get(
  '/health',
  requirePermission('tracking', 'view'),
  asyncHandler(async (req, res) => {
    return ok(res, await getTrackingHealth(requireContext(req)));
  }),
);

attributionRouter.get(
  '/',
  requirePermission('reports', 'view'),
  validate({ query: attributionQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as AttributionQuery;
    return ok(res, await getAttribution(requireContext(req), query));
  }),
);
