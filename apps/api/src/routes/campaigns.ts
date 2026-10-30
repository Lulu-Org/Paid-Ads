import {
  campaignCreateSchema,
  campaignListQuerySchema,
  campaignPlanUpdateSchema,
  campaignUpdateSchema,
  idParamSchema,
  type CampaignCreateInput,
  type CampaignListQuery,
  type CampaignPlanUpdateInput,
  type CampaignUpdateInput,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { accepted, created, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createCampaign,
  getCampaign,
  getCampaignChecklist,
  getCampaignPlan,
  launchCampaign,
  listCampaigns,
  pauseCampaign,
  replaceCampaignPlan,
  resumeCampaign,
  updateCampaign,
} from '../services/campaigns';

// Campaigns (docs/api.md "Campaigns"). Mounted at /campaigns after the global requireAuth.
export const campaignsRouter = Router();

campaignsRouter.get(
  '/',
  requirePermission('campaigns', 'view'),
  validate({ query: campaignListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as CampaignListQuery;
    const result = await listCampaigns(requireContext(req), query);
    return paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

campaignsRouter.post(
  '/',
  requirePermission('campaigns', 'create'),
  validate({ body: campaignCreateSchema }),
  asyncHandler(async (req, res) => {
    const campaign = await createCampaign(requireContext(req), req.body as CampaignCreateInput);
    return created(res, campaign);
  }),
);

campaignsRouter.get(
  '/:id',
  requirePermission('campaigns', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await getCampaign(requireContext(req), req.params.id as string));
  }),
);

campaignsRouter.patch(
  '/:id',
  requirePermission('campaigns', 'edit'),
  validate({ params: idParamSchema, body: campaignUpdateSchema }),
  asyncHandler(async (req, res) => {
    const result = await updateCampaign(
      requireContext(req),
      req.params.id as string,
      req.body as CampaignUpdateInput,
    );
    return result.approval === undefined
      ? ok(res, result.campaign)
      : accepted(res, result.approval);
  }),
);

campaignsRouter.get(
  '/:id/checklist',
  requirePermission('campaigns', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await getCampaignChecklist(requireContext(req), req.params.id as string));
  }),
);

campaignsRouter.get(
  '/:id/plan',
  requirePermission('campaigns', 'view'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    return ok(res, await getCampaignPlan(requireContext(req), req.params.id as string));
  }),
);

campaignsRouter.put(
  '/:id/plan',
  requirePermission('campaigns', 'edit'),
  validate({ params: idParamSchema, body: campaignPlanUpdateSchema }),
  asyncHandler(async (req, res) => {
    const plan = await replaceCampaignPlan(
      requireContext(req),
      req.params.id as string,
      req.body as CampaignPlanUpdateInput,
    );
    return ok(res, plan);
  }),
);

campaignsRouter.post(
  '/:id/launch',
  requirePermission('campaigns', 'edit'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await launchCampaign(requireContext(req), req.params.id as string);
    return result.approval === undefined
      ? ok(res, result.campaign)
      : accepted(res, result.approval);
  }),
);

campaignsRouter.post(
  '/:id/pause',
  requirePermission('campaigns', 'edit'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await pauseCampaign(requireContext(req), req.params.id as string);
    return ok(res, result.campaign);
  }),
);

campaignsRouter.post(
  '/:id/resume',
  requirePermission('campaigns', 'edit'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await resumeCampaign(requireContext(req), req.params.id as string);
    return ok(res, result.campaign);
  }),
);
