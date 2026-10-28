import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';

export interface ValidateSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Handlers declare their parsed types with TypedRequest<z.infer<typeof bodySchema>, ...>.
export type TypedRequest<B = unknown, Q = unknown, P = Record<string, string>> = Request<
  P,
  unknown,
  B,
  Q
>;

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params !== undefined) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query !== undefined) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.body !== undefined) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
