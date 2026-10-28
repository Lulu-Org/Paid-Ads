"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { findAdsPage } from "@/config/navigation";

/**
 * The top bar from the MagicPath design: breadcrumb (Lulu / CRM / page) and the workspace search.
 * Language and sign-out live in the profile menu at the bottom of the rail (Rail.tsx).
 */
export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const t = useTranslations("layout");
  const tNav = useTranslations("nav");
  const page = findAdsPage(usePathname());

  return (
    <header className="flex h-[69px] items-center justify-between gap-4 border-b border-border bg-surface px-5 md:px-[34px]">
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

      <label className="flex h-[38px] w-[160px] flex-none items-center gap-2 rounded-[10px] border border-[#e4e3ec] bg-surface px-[11px] text-[13px] text-[#9290a1] md:w-[218px]">
        <span aria-hidden>⌕</span>
        <input
          type="search"
          placeholder={t("searchWorkspace")}
          aria-label={t("searchWorkspace")}
          className="w-full min-w-0 bg-transparent text-[10px] text-[#474556] outline-none"
        />
      </label>
    </header>
  );
}
