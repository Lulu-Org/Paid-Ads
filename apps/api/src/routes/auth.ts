import { type LoginInput, loginInputSchema } from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { noContent, ok } from '../lib/response';
import { denyToken } from '../lib/tokenDenylist';
import { readBearerToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { login, verifyToken } from '../services/auth';

// Public: login is the only unauthenticated route under /api/v1 besides /health.
// The app-wide guard (requireAuth) is applied in routes/index.ts, so everything
// on the authed router needs a token.
export const loginRouter = Router();

loginRouter.post(
  '/auth/login',
  validate({ body: loginInputSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    return ok(res, await login(email, password));
  }),
);

export const authRouter = Router();

authRouter.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const claims = verifyToken(readBearerToken(req.headers.authorization));
    await denyToken(claims.jti, claims.exp - Math.floor(Date.now() / 1000));
    return noContent(res);
  }),
);
