import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { auditRouter } from './audit';
import { authRouter, loginRouter } from './auth';
import { campaignsRouter } from './campaigns';
import { createHealthHandler } from './health';
import { meRouter } from './me';
import { overviewRouter } from './overview';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());

// Public: the only route that does not need a token. Everything below is
// guarded by requireAuth, so a new router never ships unauthenticated.
apiRouter.use(loginRouter);
apiRouter.use(requireAuth);
apiRouter.use(authRouter);
apiRouter.use(meRouter);
apiRouter.use(usersRouter);
apiRouter.use('/audit-log', auditRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/overview', overviewRouter);
// Remaining Paid Ads routers mount here (docs/api.md): /ad-accounts, /audiences, /creatives, ...
