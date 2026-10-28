import type { ListMeta } from "@lulu/shared";

export type ListResult<T> = { data: T[]; meta: ListMeta };

// Error codes come from the API (see AGENTS.md). The UI translates them with errors.<code>.
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details: unknown = null,
  ) {
    super(code);
  }
}
