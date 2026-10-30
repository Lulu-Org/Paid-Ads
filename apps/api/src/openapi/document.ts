import pkg from '../../package.json';
import { env } from '../config/env';
import { paths } from './paths';
import { BEARER_AUTH_SCHEME, buildComponentSchemas } from './schemas';

// OpenAPI 3.1 (JSON Schema 2020-12 compatible). Schemas are generated from the
// Zod contracts in packages/shared; operations mirror docs/api.md.
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Lulu Paid Ads API',
      version: pkg.version,
      description:
        'CRM module of Lulu. The endpoint contract lives in docs/api.md; schemas live in packages/shared and are the source for the components below. Add a newly implemented endpoint to apps/api/src/openapi/paths.ts in the same pull request.',
    },
    servers: [{ url: '/' }, { url: `http://localhost:${env.PORT}` }],
    tags: [
      { name: 'Operations', description: 'Unauthenticated operational endpoints.' },
      { name: 'Auth', description: 'Log in, log out and the current user.' },
      { name: 'Users', description: 'People in the workspace.' },
      { name: 'Campaigns', description: 'Campaigns, their plan, checklist and status.' },
      { name: 'Overview', description: 'Cross-platform KPIs and the spend split.' },
    ],
    paths,
    components: {
      securitySchemes: {
        [BEARER_AUTH_SCHEME]: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token from POST /api/v1/auth/login. The workspace comes from the token.',
        },
      },
      schemas: buildComponentSchemas(),
    },
  };
}
