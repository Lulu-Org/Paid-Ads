import { BEARER_AUTH_SCHEME, schemaRef, type ComponentName } from './schemas';

// Authenticated operations carry the bearer token from POST /auth/login.
// Every /api/v1 route except POST /auth/login sits behind requireAuth
// (routes/index.ts), so the default is authenticated and only the
// unauthenticated operations opt out with security: [].
const bearer: Array<Record<string, string[]>> = [{ [BEARER_AUTH_SCHEME]: [] }];

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  responses: Record<string, unknown>;
  parameters?: unknown[];
  requestBody?: unknown;
}

export type OpenApiPaths = Record<
  string,
  Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OpenApiOperation>>
>;

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: schemaRef('ErrorEnvelope') } } },
});

const dataResponse = (description: string, name: ComponentName) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: schemaRef(name) } },
      },
    },
  },
});

const jsonBody = (name: ComponentName) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: schemaRef(name) } } },
});

const listDataResponse = (description: string, name: ComponentName) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: schemaRef(name) } },
          meta: { $ref: schemaRef('ListMeta') },
        },
      },
    },
  },
});

const authPaths: OpenApiPaths = {
  '/api/v1/auth/login': {
    post: {
      operationId: 'login',
      summary: 'Log in',
      description:
        'Email and password. Returns a bearer token; the workspace is read from the token, never the body. A wrong password and an unknown email both answer 401 UNAUTHORIZED, so the response never says which part was wrong. Unauthenticated.',
      tags: ['Auth'],
      security: [],
      requestBody: jsonBody('LoginInput'),
      responses: {
        '200': {
          description: 'Logged in.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: { $ref: schemaRef('AuthSession') } } },
              example: { data: { token: '<jwt>', expiresAt: '2026-10-19T12:00:00.000Z' } },
            },
          },
        },
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Bad credentials.'),
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      operationId: 'logout',
      summary: 'Log out',
      description:
        'Revokes the current token by adding it to a server-side denylist until it expires, so it cannot be used again.',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '204': { description: 'Logged out.' },
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
  '/api/v1/me': {
    get: {
      operationId: 'getMe',
      summary: 'Current user',
      description: 'The user the token belongs to (role and language included).',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': dataResponse('Current user.', 'User'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
    patch: {
      operationId: 'updateMe',
      summary: 'Update the current user',
      description:
        "Updates the user's name and/or language (at least one). role, email and workspaceId cannot be changed.",
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': dataResponse('Updated user.', 'User'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
  '/api/v1/users': {
    get: {
      operationId: 'listUsers',
      summary: 'People in the workspace',
      description:
        'Every user in the workspace, for owner pickers. Uses the common list parameters; q matches name or email, and sort is name (default) or createdAt, with - for descending.',
      tags: ['Users'],
      security: bearer,
      responses: {
        '200': listDataResponse('Workspace users.', 'User'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
};

// Machine-readable mirror of the "Operations and health" section in docs/api.md.
// Add every newly implemented endpoint here in the same pull request.
const auditPaths: OpenApiPaths = {
  '/api/v1/audit-log': {
    get: {
      operationId: 'listAuditLog',
      summary: 'Audit log',
      security: bearer,
      description:
        'Who changed what and when, newest first: one entry per create, update or delete of a CRM record, written by the server (also for AI and background work). Filters: entityType with entityId, actorId, correlationId (the X-Request-Id of the request that made the change). Needs settings: edit.',
      tags: ['Audit'],
      parameters: [
        ...['entityType', 'entityId', 'actorId', 'correlationId'].map((name) => ({
          name,
          in: 'query',
          required: false,
          schema: { type: 'string' },
        })),
        ...['page', 'pageSize'].map((name) => ({
          name,
          in: 'query',
          required: false,
          schema: { type: 'integer' },
        })),
      ],
      responses: {
        '200': listDataResponse('A page of audit entries.', 'AuditEntry'),
        '400': errorResponse('Invalid query.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('FORBIDDEN.'),
      },
    },
  },
};

const adAccountPaths: OpenApiPaths = {
  '/api/v1/ad-accounts': {
    get: {
      operationId: 'listAdAccounts',
      summary: 'List ad accounts',
      description:
        'Connected accounts with their platform, status, scopes and last sync. The token is never returned. Needs integrations: view.',
      tags: ['Ad accounts'],
      security: bearer,
      responses: {
        '200': listDataResponse('Connected ad accounts.', 'AdAccount'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
      },
    },
  },
  '/api/v1/ad-accounts/connect': {
    post: {
      operationId: 'connectAdAccount',
      summary: 'Start an OAuth connection',
      description:
        'Returns the provider authorize URL with a signed, single-use state (workspace, user, platform, jti). The browser visits it and the provider returns to the public callback. Needs integrations: create.',
      tags: ['Ad accounts'],
      security: bearer,
      requestBody: jsonBody('AdAccountConnectInput'),
      responses: {
        '200': dataResponse('The provider authorize URL.', 'AdAccountConnectResult'),
        '400': errorResponse('Invalid platform.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
      },
    },
  },
  '/api/v1/ad-accounts/callback/{platform}': {
    get: {
      operationId: 'completeAdAccountConnect',
      summary: 'OAuth callback',
      description:
        'Public. Verifies the signed state, consumes its jti so it cannot be replayed, exchanges the code, stores the encrypted token, queues the first ads.sync and registers the 6-hour scheduler, then redirects to CORS_ORIGIN/ads/integrations?connected=<platform>. An invalid or replayed state answers 401.',
      tags: ['Ad accounts'],
      security: [],
      parameters: [
        {
          name: 'platform',
          in: 'path',
          required: true,
          schema: { enum: ['google_lsa', 'google_ads', 'meta_ads', 'linkedin_ads'] },
        },
        { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '302': {
          description: 'Connected; redirects to the Integrations view.',
          headers: { Location: { schema: { type: 'string' } } },
        },
        '400': errorResponse('Missing code or state.'),
        '401': errorResponse('Invalid, expired or replayed state.'),
      },
    },
  },
  '/api/v1/ad-accounts/{id}/sync': {
    post: {
      operationId: 'syncAdAccount',
      summary: 'Queue a sync now',
      description:
        'Creates a queued SyncRun and adds an ads.sync job for it. The provider call runs in the worker, never in the request. Needs integrations: edit.',
      tags: ['Ad accounts'],
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': dataResponse('The queued SyncRun.', 'SyncRun'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Ad account not found.'),
        '409': errorResponse('The account is disconnected.'),
      },
    },
  },
  '/api/v1/ad-accounts/{id}': {
    delete: {
      operationId: 'disconnectAdAccount',
      summary: 'Disconnect an ad account',
      description:
        'Marks the account disconnected, clears the encrypted token, scopes and error, removes its 6-hour scheduler and keeps the row and its sync history. Needs integrations: delete.',
      tags: ['Ad accounts'],
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '204': { description: 'Disconnected.' },
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Ad account not found.'),
      },
    },
  },
};

const campaignIdParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const campaignListParameters = [
  { name: 'q', in: 'query', required: false, schema: { type: 'string' } },
  {
    name: 'platform',
    in: 'query',
    required: false,
    schema: { enum: ['google_lsa', 'google_ads', 'meta_ads', 'linkedin_ads'] },
  },
  {
    name: 'status',
    in: 'query',
    required: false,
    schema: { enum: ['draft', 'live', 'paused', 'ended'] },
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    schema: {
      enum: [
        'name',
        '-name',
        'createdAt',
        '-createdAt',
        'startAt',
        '-startAt',
        'budget',
        '-budget',
      ],
    },
  },
  { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
  {
    name: 'pageSize',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  },
];

const campaignPaths: OpenApiPaths = {
  '/api/v1/campaigns': {
    get: {
      operationId: 'listCampaigns',
      summary: 'List campaigns',
      description:
        'Campaigns with computed totals (spend, revenue, leads, CPL, ROAS and spend ÷ budget progress). Filters: platform, status and q (name or objective, case-insensitive). Sort: name (default), createdAt, startAt or budget, with - for descending. Needs campaigns: view.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: campaignListParameters,
      responses: {
        '200': listDataResponse('A page of campaigns with their totals.', 'CampaignListItem'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
      },
    },
    post: {
      operationId: 'createCampaign',
      summary: 'Create a campaign',
      description:
        'Creates a draft. The owner defaults to the current user. An adAccountId must exist in the workspace and match the platform. Needs campaigns: create.',
      tags: ['Campaigns'],
      security: bearer,
      requestBody: jsonBody('CampaignCreateInput'),
      responses: {
        '201': dataResponse('The draft campaign.', 'Campaign'),
        '400': errorResponse('Invalid body or an ad account/owner outside the workspace.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
      },
    },
  },
  '/api/v1/campaigns/{id}': {
    get: {
      operationId: 'getCampaign',
      summary: 'Campaign detail',
      description:
        'One campaign with its totals, daily metrics (oldest first), ordered plan steps, creative ids, rationale and next step. Another workspace’s campaign answers 404. Needs campaigns: view.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The campaign detail.', 'CampaignDetail'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
      },
    },
    patch: {
      operationId: 'updateCampaign',
      summary: 'Update a campaign',
      description:
        'Edits details and schedule. The platform cannot change. A budget change whose absolute amount is above the policy threshold holds the whole PATCH: the campaign stays unchanged and the response is 202 with the open budget_change ApprovalRequest. Otherwise the change is applied and the campaign returned. Needs campaigns: edit.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      requestBody: jsonBody('CampaignUpdateInput'),
      responses: {
        '200': dataResponse('The updated campaign.', 'Campaign'),
        '202': dataResponse('Approval required; the campaign was not changed.', 'ApprovalRequest'),
        '400': errorResponse('Invalid body or an ad account/owner outside the workspace.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
      },
    },
  },
  '/api/v1/campaigns/{id}/launch': {
    post: {
      operationId: 'launchCampaign',
      summary: 'Launch a campaign',
      description:
        'Runs the launch checklist. A required launch approval answers 202 with the open launch ApprovalRequest and keeps the campaign in draft. A failed checklist answers 409 with the checklist in details. On success the status becomes live locally and ads.push is queued; no provider call runs in the request. Needs campaigns: edit.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The launched campaign.', 'Campaign'),
        '202': dataResponse(
          'Launch approval required; the campaign stays in draft.',
          'ApprovalRequest',
        ),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
        '409': errorResponse('The campaign is not a draft or the checklist has failed items.'),
      },
    },
  },
  '/api/v1/campaigns/{id}/pause': {
    post: {
      operationId: 'pauseCampaign',
      summary: 'Pause a campaign',
      description:
        'Pauses a live campaign locally, then queues ads.push. Only live → paused is allowed; any other status answers 409. Needs campaigns: edit.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The paused campaign.', 'Campaign'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
        '409': errorResponse('The campaign is not live.'),
      },
    },
  },
  '/api/v1/campaigns/{id}/resume': {
    post: {
      operationId: 'resumeCampaign',
      summary: 'Resume a campaign',
      description:
        'Resumes a paused campaign locally, then queues ads.push. Only paused → live is allowed; any other status answers 409. Needs campaigns: edit.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The resumed campaign.', 'Campaign'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
        '409': errorResponse('The campaign is not paused.'),
      },
    },
  },
  '/api/v1/campaigns/{id}/checklist': {
    get: {
      operationId: 'getCampaignChecklist',
      summary: 'Launch checklist',
      description:
        'The ten launch checks and their pass state: account, budget, schedule, audience, creatives, tracking, consent, landing page, approval and owner. Needs campaigns: view.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The launch checklist.', 'CampaignChecklist'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
      },
    },
  },
  '/api/v1/campaigns/{id}/plan': {
    get: {
      operationId: 'getCampaignPlan',
      summary: 'Campaign plan',
      description: 'The campaign’s plan steps, ordered. Needs campaigns: view.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The plan steps.', 'CampaignPlan'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
      },
    },
    put: {
      operationId: 'replaceCampaignPlan',
      summary: 'Replace the campaign plan',
      description:
        'Atomically replaces the plan with the given steps (at most 20), assigning order from the array index. Needs campaigns: edit.',
      tags: ['Campaigns'],
      security: bearer,
      parameters: [campaignIdParameter],
      requestBody: jsonBody('CampaignPlanUpdateInput'),
      responses: {
        '200': dataResponse('The new plan steps.', 'CampaignPlan'),
        '400': errorResponse('Invalid body or more than 20 steps.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Campaign not found.'),
      },
    },
  },
};

const overviewPaths: OpenApiPaths = {
  '/api/v1/overview': {
    get: {
      operationId: 'getOverview',
      summary: 'Overview KPIs',
      description:
        'Spend, attributed revenue, leads, CPL and ROAS with the change against the preceding range of the same length, plus daily trends and spend by platform. The range ends on the newest day with synced metrics. rangeDays is 1–366 and defaults to 30. Needs campaigns: view.',
      tags: ['Overview'],
      security: bearer,
      parameters: [
        {
          name: 'rangeDays',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 366, default: 30 },
        },
      ],
      responses: {
        '200': dataResponse('Overview KPIs and platform split.', 'Overview'),
        '400': errorResponse('Invalid rangeDays.'),
        '401': errorResponse('Missing, invalid or expired token.'),
        '403': errorResponse('FORBIDDEN.'),
        '404': errorResponse('Workspace not found.'),
      },
    },
  },
};

const platformEnum = ['google_lsa', 'google_ads', 'meta_ads', 'linkedin_ads'];

const libraryListParameters = [
  { name: 'q', in: 'query', required: false, schema: { type: 'string' } },
  {
    name: 'sort',
    in: 'query',
    required: false,
    schema: { enum: ['name', '-name', 'createdAt', '-createdAt'] },
  },
  { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
  {
    name: 'pageSize',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  },
];

const platformParameter = {
  name: 'platform',
  in: 'query',
  required: false,
  schema: { enum: platformEnum },
};

const authErrors = {
  '401': errorResponse('Missing, invalid or expired token.'),
  '403': errorResponse('FORBIDDEN.'),
};

const creativeUploadBody = {
  required: true,
  content: {
    'application/json': { schema: { $ref: schemaRef('CreativeCreateInput') } },
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          file: { type: 'string', format: 'binary' },
          name: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
  },
};

const libraryPaths: OpenApiPaths = {
  '/api/v1/audiences': {
    get: {
      operationId: 'listAudiences',
      summary: 'List audiences',
      description:
        'Audience library with description, match rate, exclusions, campaign count and syncing flag. Filters: platform and q (name or description). Sort: name (default) or createdAt, with - for descending; any other sort answers 400. Needs audiences: view.',
      tags: ['Audiences'],
      security: bearer,
      parameters: [platformParameter, ...libraryListParameters],
      responses: {
        '200': listDataResponse('A page of audiences.', 'AudienceListItem'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        ...authErrors,
      },
    },
    post: {
      operationId: 'createAudience',
      summary: 'Create an audience',
      description: 'Creates an audience in the library. Needs audiences: create.',
      tags: ['Audiences'],
      security: bearer,
      requestBody: jsonBody('AudienceCreateInput'),
      responses: {
        '201': dataResponse('The new audience.', 'AudienceListItem'),
        '400': errorResponse('Invalid body.'),
        ...authErrors,
      },
    },
  },
  '/api/v1/audiences/{id}': {
    get: {
      operationId: 'getAudience',
      summary: 'Audience detail',
      description: 'One audience. Another workspace’s audience answers 404. Needs audiences: view.',
      tags: ['Audiences'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The audience.', 'AudienceListItem'),
        ...authErrors,
        '404': errorResponse('Audience not found.'),
      },
    },
    patch: {
      operationId: 'updateAudience',
      summary: 'Update an audience',
      description: 'Edits name, source, consent basis or platforms. Needs audiences: edit.',
      tags: ['Audiences'],
      security: bearer,
      parameters: [campaignIdParameter],
      requestBody: jsonBody('AudienceUpdateInput'),
      responses: {
        '200': dataResponse('The updated audience.', 'AudienceListItem'),
        '400': errorResponse('Invalid body.'),
        ...authErrors,
        '404': errorResponse('Audience not found.'),
      },
    },
    delete: {
      operationId: 'deleteAudience',
      summary: 'Delete an audience',
      description: 'Soft-deletes the audience. Needs audiences: delete.',
      tags: ['Audiences'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '204': { description: 'Deleted.' },
        ...authErrors,
        '404': errorResponse('Audience not found.'),
      },
    },
  },
  '/api/v1/creatives': {
    get: {
      operationId: 'listCreatives',
      summary: 'List creatives',
      description:
        'Creative library with campaign count and a winning flag. Filter: q (name). Sort: name (default) or createdAt, with - for descending. Needs creatives: view.',
      tags: ['Creatives'],
      security: bearer,
      parameters: libraryListParameters,
      responses: {
        '200': listDataResponse('A page of creatives.', 'CreativeListItem'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        ...authErrors,
      },
    },
    post: {
      operationId: 'createCreative',
      summary: 'Create a creative',
      description:
        'JSON body, or multipart/form-data with file, name and type. Files up to 25 MB; png, jpeg, webp, gif, mp4 or pdf. A wrong type or size answers 400. New creatives are pending. Needs creatives: create.',
      tags: ['Creatives'],
      security: bearer,
      requestBody: creativeUploadBody,
      responses: {
        '201': dataResponse('The new creative.', 'CreativeListItem'),
        '400': errorResponse('Invalid body, file type or file size.'),
        ...authErrors,
      },
    },
  },
  '/api/v1/creatives/{id}': {
    get: {
      operationId: 'getCreative',
      summary: 'Creative detail',
      description: 'One creative. Another workspace’s creative answers 404. Needs creatives: view.',
      tags: ['Creatives'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The creative.', 'CreativeListItem'),
        ...authErrors,
        '404': errorResponse('Creative not found.'),
      },
    },
    patch: {
      operationId: 'updateCreative',
      summary: 'Update a creative',
      description: 'Edits name, type or meta. Needs creatives: edit.',
      tags: ['Creatives'],
      security: bearer,
      parameters: [campaignIdParameter],
      requestBody: jsonBody('CreativeUpdateInput'),
      responses: {
        '200': dataResponse('The updated creative.', 'CreativeListItem'),
        '400': errorResponse('Invalid body.'),
        ...authErrors,
        '404': errorResponse('Creative not found.'),
      },
    },
    delete: {
      operationId: 'deleteCreative',
      summary: 'Delete a creative',
      description: 'Soft-deletes the creative. Needs creatives: delete.',
      tags: ['Creatives'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '204': { description: 'Deleted.' },
        ...authErrors,
        '404': errorResponse('Creative not found.'),
      },
    },
  },
  '/api/v1/creatives/{id}/approve': {
    post: {
      operationId: 'approveCreative',
      summary: 'Approve a creative',
      description:
        'Marks the creative approved by the current user. Approving twice changes nothing. Needs creatives: approve.',
      tags: ['Creatives'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '200': dataResponse('The approved creative.', 'CreativeListItem'),
        ...authErrors,
        '404': errorResponse('Creative not found.'),
      },
    },
  },
  '/api/v1/creative-tests': {
    get: {
      operationId: 'listCreativeTests',
      summary: 'Creative tests',
      description:
        'Campaigns running two or more creative variants, with spend, leads and CPL per variant and the winner’s CPL advantage. Needs creatives: view.',
      tags: ['Creatives'],
      security: bearer,
      responses: {
        '200': {
          description: 'Creative tests.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: { type: 'array', items: { $ref: schemaRef('CreativeTest') } },
                },
              },
            },
          },
        },
        ...authErrors,
      },
    },
  },
  '/api/v1/conversion-events': {
    get: {
      operationId: 'listConversionEvents',
      summary: 'List conversion events',
      description:
        'Event mapping. Filters: platform and q (name). Sort: name (default) or createdAt, with - for descending. Needs tracking: view.',
      tags: ['Tracking'],
      security: bearer,
      parameters: [platformParameter, ...libraryListParameters],
      responses: {
        '200': listDataResponse('A page of conversion events.', 'ConversionEvent'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        ...authErrors,
      },
    },
    post: {
      operationId: 'createConversionEvent',
      summary: 'Create a conversion event',
      description:
        'A null value means the value comes with each conversion. New events start as needs_attention until a conversion arrives. Needs tracking: create.',
      tags: ['Tracking'],
      security: bearer,
      requestBody: jsonBody('ConversionEventCreateInput'),
      responses: {
        '201': dataResponse('The new event.', 'ConversionEvent'),
        '400': errorResponse('Invalid body.'),
        ...authErrors,
      },
    },
  },
  '/api/v1/conversion-events/{id}': {
    patch: {
      operationId: 'updateConversionEvent',
      summary: 'Update a conversion event',
      description: 'Edits name, source, value or platforms. Needs tracking: edit.',
      tags: ['Tracking'],
      security: bearer,
      parameters: [campaignIdParameter],
      requestBody: jsonBody('ConversionEventUpdateInput'),
      responses: {
        '200': dataResponse('The updated event.', 'ConversionEvent'),
        '400': errorResponse('Invalid body.'),
        ...authErrors,
        '404': errorResponse('Event not found.'),
      },
    },
    delete: {
      operationId: 'deleteConversionEvent',
      summary: 'Delete a conversion event',
      description: 'Soft-deletes the event. Needs tracking: delete.',
      tags: ['Tracking'],
      security: bearer,
      parameters: [campaignIdParameter],
      responses: {
        '204': { description: 'Deleted.' },
        ...authErrors,
        '404': errorResponse('Event not found.'),
      },
    },
  },
  '/api/v1/tracking/health': {
    get: {
      operationId: 'getTrackingHealth',
      summary: 'Tracking health',
      description:
        'Conversions on the newest synced day, the change against the day before, and how many events need attention. Needs tracking: view.',
      tags: ['Tracking'],
      security: bearer,
      responses: {
        '200': dataResponse('Tracking health.', 'TrackingHealth'),
        ...authErrors,
      },
    },
  },
  '/api/v1/attribution': {
    get: {
      operationId: 'getAttribution',
      summary: 'Attribution and data quality',
      description:
        'Data quality, attributed revenue by platform and unmapped events. Until a CRM outcome table exists, revenue is the last 30 days of campaign revenue per platform, and model is accepted and echoed without changing the numbers. Needs reports: view.',
      tags: ['Attribution'],
      security: bearer,
      parameters: [
        {
          name: 'model',
          in: 'query',
          required: false,
          schema: {
            enum: ['data_driven', 'last_touch', 'first_touch', 'linear'],
            default: 'data_driven',
          },
        },
      ],
      responses: {
        '200': dataResponse('Attribution.', 'Attribution'),
        '400': errorResponse('Unknown model.'),
        ...authErrors,
      },
    },
  },
};


export const paths: OpenApiPaths = {
  '/health': {
    get: {
      operationId: 'getHealth',
      summary: 'Readiness check',
      description:
        'Checks Postgres and Redis. Each dependency check is bounded by a timeout (CHECK_TIMEOUT_MS, 2000ms) so a hung database cannot hang the response. Returns 200 when both are up, 503 when either is down. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  '/health/live': {
    get: {
      operationId: 'getHealthLive',
      summary: 'Liveness check',
      description:
        'Always returns 200 and touches no dependency — use it to detect a hung process. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'Process is alive.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthLiveStatus') },
              example: { data: { status: 'ok' } },
            },
          },
        },
      },
    },
  },
  '/api/v1/health': {
    get: {
      operationId: 'getHealthVersioned',
      summary: 'Readiness check (versioned alias)',
      description:
        'Alias of GET /health, for clients that only know the versioned /api/v1 base path. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  ...authPaths,
  ...auditPaths,
  ...adAccountPaths,
  ...campaignPaths,
  ...overviewPaths,
  ...libraryPaths
};
