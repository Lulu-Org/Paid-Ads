"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { findAdsPage } from "@/config/navigation";
import { api } from "@/lib/api";
import { initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";

/**
 * The top bar from the MagicPath design: breadcrumb (Lulu / Paid Ads / page), notifications and the user's avatar.
 * Language and sign-out live in the profile menu at the bottom of the rail (Rail.tsx).
 */
export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const t = useTranslations("layout");
  const tNav = useTranslations("nav");
  const page = findAdsPage(usePathname());
  const me = useApi(() => api.me(), []);

  return (
    <header className="flex h-[58px] md:h-[68px] items-center justify-between gap-4 border-b border-border bg-surface px-5 md:px-[34px]">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("openMenu")}
          className="text-xl text-text-muted lg:hidden"
        >
          ☰
        </button>
        <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-[9px] text-[9px] text-[#9998a9] md:text-[11px]">
          <span className="hidden sm:inline">Lulu</span>
          <i className="hidden not-italic text-[#c8c7d2] sm:inline">/</i>
          <strong className="text-[#353448]">{t("paidAds")}</strong>
          {page && (
            <>
              <i className="not-italic text-[#c8c7d2]">/</i>
              <strong className="truncate text-[#353448]">{tNav(page.key)}</strong>
            </>
          )}
        </nav>
      </div>

      <div className="flex flex-none items-center gap-3">
        <button
          type="button"
          aria-label={t("notifications")}
          title={t("notifications")}
          className="grid size-8 place-items-center rounded-lg text-[17px] text-[#72738b] hover:bg-[#f2f2f7] hover:text-[#282943]"
        >
          ♢
        </button>
        {me.data && (
          <span
            role="img"
            aria-label={me.data.name}
            title={me.data.name}
            className="grid size-[30px] place-items-center rounded-full bg-[#2d8b72] text-[9px] font-bold text-white"
          >
            {initials(me.data.name)}
          </span>
        )}
      </div>
    </header>
  );
}
