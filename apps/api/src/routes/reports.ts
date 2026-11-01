import {
  idParamSchema,
  libraryApiQuerySchema,
  reportCreateSchema,
  reportRunHttpQuerySchema,
  reportUpdateSchema,
  type LibraryApiQuery,
  type ReportCreateInput,
  type ReportRunQuery,
  type ReportUpdateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createReport,
  deleteReport,
  getReport,
  listReports,
  runReport,
  runSavedReport,
  updateReport,
} from '../services/reports';

// Saved and scheduled reports at /reports.
export const reportsRouter = Router();

reportsRouter.get(
  '/',
  requirePermission('reports', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listReports(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

reportsRouter.post(
  '/',
  requirePermission('reports', 'create'),
  validate({ body: reportCreateSchema }),
  asyncHandler(async (req, res) =>
    created(res, await createReport(requireContext(req), req.body as ReportCreateInput)),
  ),
);

reportsRouter.get(
  '/run',
  requirePermission('reports', 'view'),
  validate({ query: reportRunHttpQuerySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await runReport(requireContext(req), req.query as unknown as ReportRunQuery)),
  ),
);

reportsRouter.get(
  '/:id',
  requirePermission('reports', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await getReport(requireContext(req), req.params.id as string)),
  ),
);

reportsRouter.get(
  '/:id/run',
  requirePermission('reports', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await runSavedReport(requireContext(req), req.params.id as string)),
  ),
);

reportsRouter.patch(
  '/:id',
  requirePermission('reports', 'edit'),
  validate({ params: idParamSchema, body: reportUpdateSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateReport(
        requireContext(req),
        req.params.id as string,
        req.body as ReportUpdateInput,
      ),
    ),
  ),
);

reportsRouter.delete(
  '/:id',
  requirePermission('reports', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteReport(requireContext(req), req.params.id as string);
    return noContent(res);
  }),
);
