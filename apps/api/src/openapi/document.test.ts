import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './document';
import { COMPONENT_REF_PREFIX } from './schemas';

type Json = Record<string, unknown>;

function collectRefs(node: unknown, refs: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }

  return refs;
}

// The only endpoints that do not need a bearer token: the health checks and
// login. Everything else under /api/v1 sits behind requireAuth (routes/index.ts).
const UNAUTHENTICATED = new Set([
  '/health',
  '/health/live',
  '/api/v1/health',
  '/api/v1/auth/login',
]);

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument();

  it('has the required top-level fields', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toMatchObject({ title: 'Lulu Paid Ads API' });
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
  });

  it('documents every implemented operational endpoint from docs/api.md', () => {
    const paths = doc.paths as Json;

    expect(Object.keys(paths).sort()).toEqual([
      '/api/v1/audit-log',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/campaigns',
      '/api/v1/campaigns/{id}',
      '/api/v1/campaigns/{id}/checklist',
      '/api/v1/campaigns/{id}/launch',
      '/api/v1/campaigns/{id}/pause',
      '/api/v1/campaigns/{id}/plan',
      '/api/v1/campaigns/{id}/resume',
      '/api/v1/health',
      '/api/v1/me',
      '/api/v1/overview',
      '/api/v1/users',
      '/health',
      '/health/live',
    ]);

    const expectedMethods: Record<string, string[]> = {
      '/api/v1/audit-log': ['get'],
      '/api/v1/auth/login': ['post'],
      '/api/v1/auth/logout': ['post'],
      '/api/v1/campaigns': ['get', 'post'],
      '/api/v1/campaigns/{id}': ['get', 'patch'],
      '/api/v1/campaigns/{id}/checklist': ['get'],
      '/api/v1/campaigns/{id}/launch': ['post'],
      '/api/v1/campaigns/{id}/pause': ['post'],
      '/api/v1/campaigns/{id}/plan': ['get', 'put'],
      '/api/v1/campaigns/{id}/resume': ['post'],
      '/api/v1/me': ['get', 'patch'],
      '/api/v1/overview': ['get'],
      '/api/v1/users': ['get'],
    };

    for (const [path, methods] of Object.entries(expectedMethods)) {
      const pathItem = paths[path] as Json;

      for (const method of methods) {
        const operation = pathItem[method] as Json | undefined;

        expect(operation, `missing ${method.toUpperCase()} ${path}`).toBeDefined();
        expect(
          Object.keys(operation!.responses as Json).length,
          `${method.toUpperCase()} ${path} must document responses`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('marks only the unauthenticated endpoints with empty security', () => {
    const paths = doc.paths as Json;

    for (const [path, pathItemValue] of Object.entries(paths)) {
      const pathItem = pathItemValue as Json;

      for (const [method, operationValue] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

        const operation = operationValue as Json;
        const label = `${method.toUpperCase()} ${path}`;

        if (UNAUTHENTICATED.has(path)) {
          expect(operation.security, label).toEqual([]);
        } else {
          // Everything under /api/v1 except login sits behind requireAuth.
          expect(operation.security, label).toEqual([{ bearerAuth: [] }]);
        }
      }
    }
  });

  it('declares the bearer auth scheme for future authenticated endpoints', () => {
    const components = doc.components as Json;
    const securitySchemes = components.securitySchemes as Json;

    expect(securitySchemes).toHaveProperty('bearerAuth');
  });

  it('every $ref resolves against components.schemas', () => {
    const components = doc.components as Json;
    const schemas = components.schemas as Json;
    const refs = collectRefs(doc);

    expect(refs.length).toBeGreaterThan(0);

    for (const ref of refs) {
      expect(ref.startsWith(COMPONENT_REF_PREFIX), ref).toBe(true);

      const name = ref.slice(COMPONENT_REF_PREFIX.length);
      expect(schemas, `unresolved ref ${ref}`).toHaveProperty(name);
    }
  });

  it('uses the health response examples from docs/api.md', () => {
    const paths = doc.paths as Json;
    const health = (paths['/health'] as Json).get as Json;
    const responses = health.responses as Json;

    const ok = responses['200'] as Json;
    expect((ok.content as Json)['application/json']).toMatchObject({
      example: {
        data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
      },
    });

    const degraded = responses['503'] as Json;
    expect((degraded.content as Json)['application/json']).toMatchObject({
      example: {
        data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
      },
    });

    const live = ((paths['/health/live'] as Json).get as Json).responses as Json;
    expect(((live['200'] as Json).content as Json)['application/json']).toMatchObject({
      example: { data: { status: 'ok' } },
    });
  });

  it('generates schemas from packages/shared contracts', () => {
    const components = doc.components as Json;
    const schemas = components.schemas as Json;
    const healthStatus = schemas.HealthStatus as Json;

    expect(healthStatus).toMatchObject({
      type: 'object',
      properties: {
        data: {
          properties: {
            status: { enum: ['ok', 'degraded'] },
            checks: {
              properties: {
                database: { enum: ['ok', 'down'] },
                redis: { enum: ['ok', 'down'] },
              },
            },
          },
        },
      },
    });
  });
});
