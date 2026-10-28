import type { ErrorCode } from '@lulu/shared';

const CODE_STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function codeToStatus(code: ErrorCode): number {
  return CODE_STATUS[code] ?? 500;
}

export function codeToMessageKey(code: ErrorCode): string {
  return `errors.${code}`;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, status?: number, details: unknown = null) {
    super(codeToMessageKey(code));
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? codeToStatus(code);
    this.details = details;
  }

  static notFound(code: ErrorCode): AppError {
    return new AppError(code, 404);
  }

  static validation(details: unknown): AppError {
    return new AppError('VALIDATION_ERROR', 400, details);
  }

  static unauthorized(): AppError {
    return new AppError('UNAUTHORIZED', 401);
  }

  static forbidden(): AppError {
    return new AppError('FORBIDDEN', 403);
  }

  static conflict(code: ErrorCode, details: unknown = null): AppError {
    return new AppError(code, 409, details);
  }
}
