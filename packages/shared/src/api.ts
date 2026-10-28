import { z } from 'zod';
import { ERROR_CODES } from './errors';
import { listMetaSchema } from './common';

export const errorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
});

// Success envelope from AGENTS.md: { "data": { }, "meta": { } } with meta only on lists.
export const successSchema = z.object({
  data: z.unknown(),
  meta: listMetaSchema.optional(),
});

export type SuccessEnvelope = z.infer<typeof successSchema>;
export type ErrorEnvelope = z.infer<typeof errorSchema>;
