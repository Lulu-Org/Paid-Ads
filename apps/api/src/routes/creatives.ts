import {
  creativeCreateSchema,
  creativeUpdateSchema,
  idParamSchema,
  libraryApiQuerySchema,
  type CreativeCreateInput,
  type CreativeUpdateInput,
  type LibraryApiQuery,
} from '@lulu/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../lib/asyncHandler';
import { AppError } from '../lib/errors';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  approveCreative,
  createCreative,
  deleteCreative,
  getCreative,
  listCreatives,
  listCreativeTests,
  updateCreative,
} from '../services/creatives';

// Creative library at /creatives and creative tests at /creative-tests.
export const creativesRouter = Router();
export const creativeTestsRouter = Router();

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    return cb(
      AppError.validation([
        { path: 'file', code: 'invalid_file_type', message: 'errors.validation.invalid_file_type' },
      ]),
    );
  },
});

// Turns multer's own errors into the API's 400 VALIDATION_ERROR. A JSON request passes through.
function uploadFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'invalid_file';
      next(AppError.validation([{ path: 'file', code, message: `errors.validation.${code}` }]));
      return;
    }
    next(err);
  });
}

creativesRouter.get(
  '/',
  requirePermission('creatives', 'view'),
  validate({ query: libraryApiQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as LibraryApiQuery;
    const result = await listCreatives(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

creativesRouter.post(
  '/',
  requirePermission('creatives', 'create'),
  uploadFile,
  validate({ body: creativeCreateSchema }),
  asyncHandler(async (req, res) => {
    const creative = await createCreative(
      requireContext(req),
      req.body as CreativeCreateInput,
      req.file,
    );
    return created(res, creative);
  }),
);

creativesRouter.get(
  '/:id',
  requirePermission('creatives', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await getCreative(requireContext(req), req.params.id as string));
  }),
);

creativesRouter.patch(
  '/:id',
  requirePermission('creatives', 'edit'),
  validate({ params: idParamSchema, body: creativeUpdateSchema }),
  asyncHandler(async (req, res) => {
    const creative = await updateCreative(
      requireContext(req),
      req.params.id as string,
      req.body as CreativeUpdateInput,
    );
    return ok(res, creative);
  }),
);

creativesRouter.delete(
  '/:id',
  requirePermission('creatives', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteCreative(requireContext(req), req.params.id as string);
    return noContent(res);
  }),
);

creativesRouter.post(
  '/:id/approve',
  requirePermission('creatives', 'approve'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await approveCreative(requireContext(req), req.params.id as string));
  }),
);

creativeTestsRouter.get(
  '/',
  requirePermission('creatives', 'view'),
  asyncHandler(async (req, res) => {
    return ok(res, await listCreativeTests(requireContext(req)));
  }),
);