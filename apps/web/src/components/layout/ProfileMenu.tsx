"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { useSignOut } from "@/features/auth/AuthGate";
import { api } from "@/lib/api";
import { loginRequired } from "@/lib/auth";
import { initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The signed-in user at the bottom of the rail. Its menu holds the language switcher and sign-out,
 * which the MagicPath design's top bar no longer has room for.
 */
export function ProfileMenu() {
  const t = useTranslations("layout");
  const tAuth = useTranslations("auth");
  const signOut = useSignOut();
  const me = useApi(() => api.me(), []);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const user = me.data;

  return (
    <div ref={box} className="relative mt-3.5 border-t border-[#2d2c3d] pt-4">
      {open && (
        <div
          id="profile-menu"
          role="group"
          aria-label={t("profileMenu")}
          className="absolute right-0 bottom-full left-0 mb-2 grid gap-3 rounded-[10px] border border-border bg-surface p-3 shadow-card"
        >
          <LanguageSwitcher />
          {loginRequired && (
            <button
              type="button"
              onClick={() => signOut(api.auth.logout)}
              className="rounded-md px-2 py-1.5 text-left text-[11px] font-semibold text-text-muted hover:bg-surface-muted hover:text-primary"
            >
              {tAuth("signOut")}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="profile-menu"
        aria-label={t("profileMenu")}
        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-rail-hover"
      >
        <Avatar initials={user ? initials(user.name) : "…"} small />
        <span className="min-w-0">
          <strong className="block truncate text-[11px] text-white">{user?.name ?? ""}</strong>
          <small className="block text-[9px] text-rail-label">{user ? t(`role.${user.role}`) : ""}</small>
        </span>
        <span className="ml-auto text-[#85869b]" aria-hidden>
          {open ? "⌃" : "⌄"}
        </span>
      </button>
    </div>
  );
}
