"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { setUnauthorizedHandler } from "@/lib/api/http";
import { endSession, loginRequired, restoreSession } from "@/lib/auth";

/**
 * Keeps the CRM pages behind sign-in whenever any area uses the real API.
 * No valid session: go to /login and come back here after. The session expires, or the API
 * rejects the token: sign out and do the same. In full mock mode it just shows the page.
 */
export function AuthGate({ children, required = loginRequired }: { children: React.ReactNode; required?: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(!required);

  useEffect(() => {
    if (!required) return;
    const toLogin = () => router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    const signOut = () => {
      endSession();
      toLogin();
    };

    const session = restoreSession();
    if (!session) {
      toLogin();
      return;
    }
    setUnauthorizedHandler(signOut);
    // Sign out the moment the token expires, rather than on the next failed request.
    const timer = setTimeout(signOut, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    setReady(true);
    return () => {
      clearTimeout(timer);
      setUnauthorizedHandler(null);
    };
    // Checked once when the CRM opens; moving between CRM pages keeps the same session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required]);

  if (!ready) {
    return (
      <div role="status" aria-busy="true" className="grid min-h-screen place-items-center bg-bg text-[11px] text-text-subtle">
        {t("checking")}
      </div>
    );
  }
  return <>{children}</>;
}

/** Signs out on the server (best effort) and here, then shows the sign-in page. */
export function useSignOut() {
  const router = useRouter();
  return async (logout: () => Promise<unknown>) => {
    try {
      await logout();
    } catch {
      // The token is dropped here either way; a failed server logout only means it expires on its own.
    }
    endSession();
    router.replace("/login");
  };
}
