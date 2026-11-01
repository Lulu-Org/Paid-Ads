import type { LibraryApiQuery } from '@lulu/shared';

type Direction = 'asc' | 'desc';

// Shared by the library endpoints; the query schema already limits sort to these four values.
export function libraryOrderBy(sort: LibraryApiQuery['sort']): Record<string, Direction> {
  switch (sort) {
    case '-name':
      return { name: 'desc' };
    case 'createdAt':
      return { createdAt: 'asc' };
    case '-createdAt':
      return { createdAt: 'desc' };
    default:
      return { name: 'asc' };
  }
}

export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return (value as { toNumber(): number }).toNumber();
}
