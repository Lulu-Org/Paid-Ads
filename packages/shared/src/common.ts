import { z } from "zod";

export const idSchema = z.string().min(1);

// Timestamps travel as ISO 8601 strings with a time zone, for example "2026-10-28T12:00:00.000Z".
export const timestampSchema = z.iso.datetime({ offset: true });

// ISO 4217 code, for example "EUR".
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const moneySchema = z.object({
  amount: z.number().finite(),
  currency: currencySchema,
});

// Probabilities and rates are fractions from 0 to 1, so the UI can pass them straight to Intl percent formatting.
export const fractionSchema = z.number().min(0).max(1);

// Fields every table has (see docs/data-model.md).
export const baseRecordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

// Common list parameters (see docs/api.md). Query strings arrive as text, so numbers are coerced.
export const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  sort: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const listMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
});

export type Id = z.infer<typeof idSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type Money = z.infer<typeof moneySchema>;
export type BaseRecord = z.infer<typeof baseRecordSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type ListMeta = z.infer<typeof listMetaSchema>;

// Path parameter for single-resource routes: /contacts/<id>.
export const idParamSchema = z.object({
  id: idSchema,
});
