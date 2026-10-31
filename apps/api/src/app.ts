import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';
import { requestLog } from './middleware/requestLog';
import './middleware/requestContext';
import { buildManifest } from './manifest';
import { buildOpenApiDocument } from './openapi/document';
import { swaggerUiCsp } from './openapi/ui';
import { apiRouter } from './routes';
import { createHealthHandler, liveHandler } from './routes/health';
import path from 'path';

export function createApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(requestLog);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', createHealthHandler());
  app.get('/health/live', liveHandler);
  // The bundle manifest for the Lulu platform (src/manifest.ts). Public, like /health and /docs.json.
  const manifest = buildManifest();
  app.get('/manifest.json', (_req, res) => {
    res.json(manifest);
  });
  app.use('/api/v1', apiRouter);

  const openApiDocument = buildOpenApiDocument();
  app.get('/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/docs', swaggerUiCsp, swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(undefined, { swaggerOptions: { url: '/docs.json' } }));

  app.use(notFound);
  app.use(errorHandler);

  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR ?? 'uploads')));

  return app;
}
