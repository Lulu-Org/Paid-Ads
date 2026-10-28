import type { AuthSession, LoginInput } from "@lulu/shared";
import { demoUsers } from "./fixtures";
import { ApiError, type ListResult } from "./types";

// The same shape as real.ts, answered from the design's sample data.

const CURRENT_USER_ID = "user_jamie";

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150));

function paginate<T>(rows: T[], page = 1, pageSize = 25): ListResult<T> {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), meta: { page, pageSize, total: rows.length } };
}

export const mockApi = {
  auth: {
    async login(input: LoginInput): Promise<AuthSession> {
      const user = demoUsers.find((u) => u.email === input.email.trim().toLowerCase());
      if (!user || !input.password) throw new ApiError("UNAUTHORIZED", 401);
      return delay({ token: `mock-${user.id}`, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    },
    async logout() {
      return delay(undefined);
    },
  },

  me: () => delay(demoUsers.find((u) => u.id === CURRENT_USER_ID)!),
  users: () => delay(paginate(demoUsers)),
};
