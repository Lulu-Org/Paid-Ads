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
};
