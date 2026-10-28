import { authSessionSchema, userSchema, type LoginInput } from "@lulu/shared";
import { getList, getOne, post, write } from "./http";

// Endpoints from docs/api.md. Keep the same shape as mock.ts.
export const realApi = {
  auth: {
    login: (input: LoginInput) => write(authSessionSchema, "POST", "/auth/login", input),
    logout: () => post("/auth/logout"),
  },

  me: () => getOne(userSchema, "/me"),
  users: () => getList(userSchema, "/users"),
};
