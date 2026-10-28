import type { RequestHandler } from 'express';
import { correlationIdFrom, runAs } from '../lib/actorContext';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// X-Request-Id doubles as the correlation id of the audit log and domain events. A caller may pass
// its own (other Lulu modules do, to trace a flow across bundles); anything that does not look like
// an id is replaced. The rest of the request runs in an actor context that sign-in fills in.
export const requestId: RequestHandler = (req, res, next) => {
  req.id = correlationIdFrom(req.header('x-request-id'));
  res.setHeader('X-Request-Id', req.id);
  runAs({ actorType: 'system', correlationId: req.id }, next);
};
