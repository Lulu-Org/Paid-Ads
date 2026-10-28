import { type MeUpdateInput, meUpdateSchema } from '@lulu/shared';
import { Router } from 'express';
import { scopedDb } from '../db/scoped';
import { asyncHandler } from '../lib/asyncHandler';
import { AppError } from '../lib/errors';
import { ok } from '../lib/response';
import { requireAuth } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { getUserById } from '../services/auth';
import { toUserDto } from '../services/users';

export const meRouter = Router();

meRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ctx = requireContext(req);
    const user = await getUserById(ctx.userId);
    if (user === null) {
      throw AppError.unauthorized();
    }
    return ok(res, toUserDto(user));
  }),
);

meRouter.patch(
  '/me',
  requireAuth,
  validate({ body: meUpdateSchema }),
  asyncHandler(async (req, res) => {
    const ctx = requireContext(req);
    const input = req.body as MeUpdateInput;
    const user = await scopedDb(ctx.workspaceId).user.update({
      where: { id: ctx.userId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.language === undefined ? {} : { language: input.language }),
      },
    });
    return ok(res, toUserDto(user));
  }),
);
