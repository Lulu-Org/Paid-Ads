import {
  audienceCreateSchema,
  audienceUpdateSchema,
  idParamSchema,
  libraryApiQuerySchema,
  type LibraryApiQuery,
  type AudienceCreateInput,
  type AudienceUpdateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createAudience,
  deleteAudience,
  getAudience,
  listAudiences,
  updateAudience,
} from '../services/audiences';

// Audience library (docs/api.md "Audiences, creatives, tracking"). Mounted at /audiences.
export const audiencesRouter = Router();

audiencesRouter.get(
  '/',
  requirePermission('audiences', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listAudiences(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

audiencesRouter.post(
  '/',
  requirePermission('audiences', 'create'),
  validate({ body: audienceCreateSchema }),
  asyncHandler(async (req, res) => {
    const audience = await createAudience(requireContext(req), req.body as AudienceCreateInput);
    return created(res, audience);
  }),
);

audiencesRouter.get(
  '/:id',
  requirePermission('audiences', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await getAudience(requireContext(req), req.params.id as string));
  }),
);

audiencesRouter.patch(
  '/:id',
  requirePermission('audiences', 'edit'),
  validate({ params: idParamSchema, body: audienceUpdateSchema }),
  asyncHandler(async (req, res) => {
    const audience = await updateAudience(
      requireContext(req),
      req.params.id as string,
      req.body as AudienceUpdateInput,
    );
    return ok(res, audience);
  }),
);

audiencesRouter.delete(
  '/:id',
  requirePermission('audiences', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteAudience(requireContext(req), req.params.id as string);
    return res.status(204).end();
  }),
);