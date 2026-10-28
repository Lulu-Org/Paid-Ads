import { z } from "zod";
import { listMetaSchema } from "@lulu/shared";
import { ApiError, type ListResult } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

let token: string | null = null;

export function setAuthToken(value: string | null) {
  token = value;
}

// Called when the API rejects the token we sent (expired, logged out, user removed), so the app can sign out.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function send(method: string, path: string, body?: unknown, query?: object) {
  const url = new URL(baseUrl + path, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  // Files go as multipart form data; the browser sets that Content-Type (with its boundary) itself.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", 0);
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    // Only a rejected token signs the user out; a failed login (no token yet) just shows its error.
    if (response.status === 401 && token && onUnauthorized) onUnauthorized();
    const error = json?.error;
    throw new ApiError(error?.code ?? "UNKNOWN_ERROR", response.status, error?.details ?? null);
  }
  return json;
}

// Every response is checked against the shared Zod schema, so a contract change shows up at once.
export async function getOne<T extends z.ZodType>(schema: T, path: string, query?: object) {
  const json = await send("GET", path, undefined, query);
  return schema.parse(json.data) as z.infer<T>;
}

export async function getList<T extends z.ZodType>(
  schema: T,
  path: string,
  query?: object,
): Promise<ListResult<z.infer<T>>> {
  const json = await send("GET", path, undefined, query);
  return { data: z.array(schema).parse(json.data), meta: listMetaSchema.parse(json.meta) };
}

export async function write<T extends z.ZodType>(
  schema: T,
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
) {
  const json = await send(method, path, body);
  return schema.parse(json.data) as z.infer<T>;
}

export async function remove(path: string) {
  await send("DELETE", path);
}

// Uploads one file as multipart form data (field "file"), for example POST /imports.
export async function upload<T extends z.ZodType>(schema: T, path: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const json = await send("POST", path, form);
  return schema.parse(json.data) as z.infer<T>;
}

// POST that answers without a body, for example POST /auth/logout (204).
export async function post(path: string, body: unknown = {}) {
  await send("POST", path, body);
}
