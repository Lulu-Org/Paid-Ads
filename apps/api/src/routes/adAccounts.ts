import {
  adAccountConnectSchema,
  adPlatformSchema,
  idParamSchema,
  type AdAccountConnectInput,
  type AdPlatform,
} from '@lulu/shared';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  completeCallback,
  disconnect,
  listAdAccounts,
  queueSync,
  startConnect,
} from '../services/adAccounts';

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const callbackParamsSchema = z.object({ platform: adPlatformSchema });

// Public: mounted before the global requireAuth (routes/index.ts). The signed, single-use state is
// the authorization check; the callback then redirects back to the web app.
export const adAccountsCallbackRouter = Router();

adAccountsCallbackRouter.get(
  '/callback/:platform',
  validate({ params: callbackParamsSchema, query: callbackQuerySchema }),
  asyncHandler(async (req, res) => {
    const { platform } = req.params as { platform: AdPlatform };
    const { code, state } = req.query as unknown as z.infer<typeof callbackQuerySchema>;
    const result = await completeCallback(platform, code, state);
    return res.redirect(302, result.redirectUrl);
  }),
);

// Authenticated ad-account management. Mounted at /ad-accounts after requireAuth.
export const adAccountsRouter = Router();

adAccountsRouter.get(
  '/',
  requirePermission('integrations', 'view'),
  asyncHandler(async (req, res) => {
    const accounts = await listAdAccounts(requireContext(req));
    return paginated(res, accounts, {
      page: 1,
      pageSize: Math.max(accounts.length, 1),
      total: accounts.length,
    });
  }),
);

adAccountsRouter.post(
  '/connect',
  requirePermission('integrations', 'create'),
  validate({ body: adAccountConnectSchema }),
  asyncHandler(async (req, res) => {
    const { platform } = req.body as AdAccountConnectInput;
    return ok(res, await startConnect(requireContext(req), platform));
  }),
);

adAccountsRouter.post(
  '/:id/sync',
  requirePermission('integrations', 'edit'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await queueSync(requireContext(req), req.params.id as string));
  }),
);

adAccountsRouter.delete(
  '/:id',
  requirePermission('integrations', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await disconnect(requireContext(req), req.params.id as string);
    return noContent(res);
  }),
);
