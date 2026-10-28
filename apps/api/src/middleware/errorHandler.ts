import { ERROR_CODES } from '@lulu/shared';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

interface ZodIssueLike {
  code: string;
  path: PropertyKey[];
}

function zodErrorToDetails(err: ZodError): Array<{ path: string; code: string; message: string }> {
  return err.issues.map((issue: ZodIssueLike) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code,
    message: `errors.validation.${issue.code}`,
  }));
}

interface ErrorWithCode extends Error {
  code: string;
}

function isErrorWithCode(err: unknown): err is ErrorWithCode {
  return err instanceof Error && 'code' in err && typeof (err as ErrorWithCode).code === 'string';
}

interface BodyParseError extends SyntaxError {
  type: string;
}

function isBodyParseError(err: unknown): err is BodyParseError {
  return (
    err instanceof SyntaxError &&
    'type' in err &&
    (err as BodyParseError).type === 'entity.parse.failed'
  );
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (err instanceof ZodError) {
    return AppError.validation(zodErrorToDetails(err));
  }
  if (isBodyParseError(err)) {
    return AppError.validation([
      { path: 'body', code: 'invalid_json', message: 'errors.validation.invalid_json' },
    ]);
  }
  if (isErrorWithCode(err)) {
    if (err.code === 'P2002') {
      return new AppError(ERROR_CODES.CONFLICT, 409);
    }
    if (err.code === 'P2025') {
      return new AppError(ERROR_CODES.NOT_FOUND, 404);
    }
  }
  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500);
}

// Express only treats a middleware as an error handler when it declares 4 parameters.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }
  const appError = toAppError(err);
  if (appError.status >= 500) {
    console.error(
      `[${req.id ?? 'no-request-id'}] unhandled error:`,
      err instanceof Error ? (err.stack ?? err.message) : err,
    );
  }
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
  });
};
