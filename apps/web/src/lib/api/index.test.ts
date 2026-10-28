import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAreas, chooseApi } from "./index";
import { mockApi } from "./mock";
import { realApi } from "./real";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chooseApi", () => {
  it("uses sample data everywhere by default", () => {
    const { api, realAreas } = chooseApi(undefined, undefined);
    expect(realAreas).toEqual([]);
    for (const area of apiAreas) expect(api[area]).toBe(mockApi[area]);
  });

  it("uses the real API everywhere when mock mode is off", () => {
    const { api, realAreas } = chooseApi("false", "me");
    expect(realAreas).toEqual(apiAreas);
    expect(api).toBe(realApi);
  });

  it("switches only the listed areas to the real API", () => {
    const { api, realAreas } = chooseApi("true", " me ,");
    expect(realAreas.sort()).toEqual(["auth", "me"]);
    // Sign-in follows any real area, so login gets a real token.
    expect(api.auth).toBe(realApi.auth);
    expect(api.me).toBe(realApi.me);
    expect(api.users).toBe(mockApi.users);
  });

  it("ignores and reports unknown areas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { realAreas } = chooseApi(undefined, "users,campaignz");
    expect(realAreas.sort()).toEqual(["auth", "users"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("campaignz"));
  });

  it("covers every area of the real API in the mock too", () => {
    for (const area of apiAreas) expect(mockApi[area as keyof typeof mockApi]).toBeDefined();
  });
});
