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
import { approvalsRouter } from './approvals';
import { approvalPolicyRouter, spendLimitRouter } from './controls';
import { automationsRouter } from './automations';
import { reportsRouter } from './reports';

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
apiRouter.use('/audiences', audiencesRouter);
apiRouter.use('/creatives', creativesRouter);
apiRouter.use('/creative-tests', creativeTestsRouter);
apiRouter.use('/conversion-events', conversionEventsRouter);
apiRouter.use('/tracking', trackingRouter);
apiRouter.use('/attribution', attributionRouter);
apiRouter.use('/approvals', approvalsRouter);
apiRouter.use('/spend-limit', spendLimitRouter);
apiRouter.use('/approval-policy', approvalPolicyRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/automations', automationsRouter);
// Remaining Paid Ads routers mount here (docs/api.md): /ad-accounts, /audiences, /creatives, ...
