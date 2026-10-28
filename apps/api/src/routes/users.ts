import { type UserListQuery, userListQuerySchema } from '@lulu/shared';
import { Router } from 'express';
import { scopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { asyncHandler } from '../lib/asyncHandler';
import { paginated } from '../lib/response';
import { requireAuth } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { toUserDto } from '../services/users';

export const usersRouter = Router();

usersRouter.get(
  '/users',
  requireAuth,
  validate({ query: userListQuerySchema }),
  asyncHandler(async (req, res) => {
    const ctx = requireContext(req);
    const { q, sort, page, pageSize } = req.query as unknown as UserListQuery;

    const descending = sort?.startsWith('-') ?? false;
    const direction: Prisma.SortOrder = descending ? 'desc' : 'asc';
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'createdAt' || sort === '-createdAt'
        ? { createdAt: direction }
        : { name: direction };
    const where: Prisma.UserWhereInput =
      q === undefined
        ? {}
        : {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          };

    const users = scopedDb(ctx.workspaceId).user;
    const [rows, total] = await Promise.all([
      users.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      users.count({ where }),
    ]);

    return paginated(res, rows.map(toUserDto), { page, pageSize, total });
  }),
);
