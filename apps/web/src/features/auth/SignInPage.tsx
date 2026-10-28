"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError, useMock } from "@/lib/api";
import { readSession, safeNext, startSession } from "@/lib/auth";
import { useErrorMessage } from "@/lib/errors";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[12px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

// The page to return to, from ?next=, read when needed so the page needs no search-params boundary.
const nextPath = () =>
  safeNext(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next"));

export function SignInPage() {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: go straight on.
  useEffect(() => {
    if (readSession()) router.replace(nextPath());
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("errors.missing"));
      return;
    }
    setBusy(true);
    try {
      startSession(await api.auth.login({ email: email.trim(), password }));
      router.replace(nextPath());
    } catch (err) {
      // Wrong email and wrong password are the same answer on purpose (docs/api.md).
      setError(err instanceof ApiError && err.code === "UNAUTHORIZED" ? t("errors.wrong") : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-4 flex items-center justify-between">
          <strong className="text-[15px] font-black tracking-tight text-text">{t("brand")}</strong>
          <LanguageSwitcher />
        </div>
        <Card>
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-text">{t("title")}</h1>
          <p className="mt-1.5 text-[11px] text-text-muted">{t("intro")}</p>

          <form onSubmit={submit} noValidate className="mt-5 grid gap-3.5">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-email`} className="text-[10px] font-extrabold text-neutral">{t("email")}</label>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                autoFocus
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-password`} className="text-[10px] font-extrabold text-neutral">{t("password")}</label>
              <input
                id={`${id}-password`}
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-[#ffe1e0] px-3 py-2 text-[11px] text-[#8a2f2c]">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy} className="mt-1 w-full">
              {t("submit")}
            </Button>
          </form>

          {useMock && <p className="mt-4 text-[10px] text-text-subtle">{t("mockHint", { email: "jamie@lulu.demo" })}</p>}
        </Card>
      </div>
    </main>
  );
}
