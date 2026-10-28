import { mockApi } from "./mock";
import { realApi } from "./real";

export { ApiError, type ListResult } from "./types";
export { setAuthToken } from "./http";

type Api = typeof realApi;
export type ApiArea = keyof Api;

// Every area of the API client: auth, me, users, and the Paid Ads areas as they land.
export const apiAreas = Object.keys(realApi) as ApiArea[];

/**
 * Picks the mock or the real API for each area, so pages can move to the real API one at a time
 * as the backend endpoints land.
 *
 * - NEXT_PUBLIC_USE_MOCK=false: every area uses the real API.
 * - NEXT_PUBLIC_USE_MOCK=true (the default): every area uses the design's sample data,
 *   except the areas listed in NEXT_PUBLIC_REAL_API, for example "me,users,campaigns".
 *   As soon as any area is real, `auth` (login and logout) is real too: a real area needs a real token.
 *
 * Unknown names in the list are reported in the console and ignored.
 */
export function chooseApi(useMockSetting: string | undefined, realAreasSetting: string | undefined) {
  if (useMockSetting === "false") return { api: realApi, realAreas: apiAreas };

  const requested = (realAreasSetting ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
  const unknown = requested.filter((area) => !apiAreas.includes(area as ApiArea));
  if (unknown.length > 0) {
    console.warn(`NEXT_PUBLIC_REAL_API: unknown area(s) ${unknown.join(", ")}. Known: ${apiAreas.join(", ")}`);
  }
  // Any real area needs a real token, so sign-in follows automatically.
  if (requested.length > 0 && !requested.includes("auth")) requested.push("auth");
  const realAreas = apiAreas.filter((area) => requested.includes(area));

  const api = Object.fromEntries(
    apiAreas.map((area) => [area, realAreas.includes(area) ? realApi[area] : mockApi[area]]),
  ) as Api;
  return { api, realAreas };
}

// Next.js only inlines NEXT_PUBLIC_ variables written out in full, so read them here by name.
const choice = chooseApi(process.env.NEXT_PUBLIC_USE_MOCK, process.env.NEXT_PUBLIC_REAL_API);

export const api: Api = choice.api;

// Areas on the real API right now (empty in full mock mode).
export const realAreas: ApiArea[] = choice.realAreas;

// True when every area uses sample data.
export const useMock = realAreas.length === 0;
