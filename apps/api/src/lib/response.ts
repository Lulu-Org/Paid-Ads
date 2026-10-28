import { Decimal } from '@prisma/client/runtime/client';
import type { ListMeta } from '@lulu/shared';
import type { Response } from 'express';

// Prisma returns Decimal columns as Decimal objects, and JSON.stringify would emit them as
// strings ("24000.00"). The money rule says a number, so convert at the response helpers —
// the single place every payload leaves the API.
function toJsonSafe(value: unknown): unknown {
  if (value instanceof Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value instanceof Date) return value;
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value) as object | null;
    if (proto === Object.prototype || proto === null) {
      const entries = Object.entries(value).map(
        ([key, entry]) => [key, toJsonSafe(entry)] as [string, unknown],
      );
      return Object.fromEntries(entries);
    }
  }
  return value;
}

export function ok(res: Response, data: unknown, meta?: ListMeta): Response {
  const body = meta === undefined ? { data: toJsonSafe(data) } : { data: toJsonSafe(data), meta };
  return res.status(200).json(body);
}

export function created(res: Response, data: unknown): Response {
  return res.status(201).json({ data: toJsonSafe(data) });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated(res: Response, items: unknown, meta: ListMeta): Response {
  return res.status(200).json({ data: toJsonSafe(items), meta });
}
