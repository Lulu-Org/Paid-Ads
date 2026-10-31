import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { adAccountsCallbackRouter, adAccountsRouter } from './adAccounts';
import { auditRouter } from './audit';
import { authRouter, loginRouter } from './auth';
import { campaignsRouter } from './campaigns';
import { createHealthHandler } from './health';
import { meRouter } from './me';
import { overviewRouter } from './overview';
import { usersRouter } from './users';
import { creativesRouter, creativeTestsRouter } from './creatives';
import { audiencesRouter } from './audiences';
import { attributionRouter, conversionEventsRouter, trackingRouter } from './tracking';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());

// Public: login and the OAuth callback (the signed state is its authorization check). Everything
// below is guarded by requireAuth, so a new router never ships unauthenticated.
apiRouter.use(loginRouter);
apiRouter.use('/ad-accounts', adAccountsCallbackRouter);
apiRouter.use(requireAuth);
apiRouter.use(authRouter);
apiRouter.use(meRouter);
apiRouter.use(usersRouter);
apiRouter.use('/audit-log', auditRouter);
apiRouter.use('/ad-accounts', adAccountsRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/overview', overviewRouter);
// Remaining Paid Ads routers mount here (docs/api.md): /audiences, /creatives, ...
