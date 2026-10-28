import { authSessionSchema, type AuthSession } from "@lulu/shared";
import { realAreas, setAuthToken } from "@/lib/api";
import { ADS_HOME } from "@/config/navigation";

// The sign-in session: the token from POST /auth/login and when it expires.
// Kept in localStorage so a reload stays signed in; every read checks the expiry.

const KEY = "lulu.session";

// Any area on the real API needs a token, so sign-in is required then. In full mock mode it is not.
export const loginRequired = realAreas.length > 0;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored session if it is still valid; an expired or unreadable one is removed. */
export function readSession(now: number = Date.now()): AuthSession | null {
  const store = storage();
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed = authSessionSchema.safeParse(JSON.parse(raw));
    if (parsed.success && Date.parse(parsed.data.expiresAt) > now) return parsed.data;
  } catch {
    // Unreadable value: treat as signed out.
  }
  store?.removeItem(KEY);
  return null;
}

/** After a successful login: remember the session and send its token with every request. */
export function startSession(session: AuthSession) {
  storage()?.setItem(KEY, JSON.stringify(session));
  setAuthToken(session.token);
}

/** On logout, expiry or a rejected token. */
export function endSession() {
  storage()?.removeItem(KEY);
  setAuthToken(null);
}

/** On page load: put a stored, still-valid token back on the API client. */
export function restoreSession(): AuthSession | null {
  const session = readSession();
  setAuthToken(session?.token ?? null);
  return session;
}

/** Where to go after signing in: only paths inside this app, never another site. */
export function safeNext(next: string | null | undefined, fallback = ADS_HOME): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
