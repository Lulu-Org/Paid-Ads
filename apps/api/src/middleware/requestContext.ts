import type { Request } from 'express';
import { AppError } from '../lib/errors';

export interface RequestContext {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

export function requireContext(req: Request): RequestContext {
  if (req.ctx === undefined) {
    throw AppError.unauthorized();
  }
  return req.ctx;
}
