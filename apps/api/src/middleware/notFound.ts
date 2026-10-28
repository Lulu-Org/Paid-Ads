import { ERROR_CODES } from '@lulu/shared';
import type { RequestHandler } from 'express';
import { codeToMessageKey } from '../lib/errors';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: codeToMessageKey(ERROR_CODES.NOT_FOUND),
      details: null,
    },
  });
};
