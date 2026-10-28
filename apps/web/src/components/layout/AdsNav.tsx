"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { adsHref, adsMenu, adsPage, findAdsMenuItem } from "@/config/navigation";

// Below lg the rail is hidden, so the CRM menu scrolls as tabs above the content.
export function AdsTabs() {
  const t = useTranslations("nav");
  const active = findAdsMenuItem(usePathname());
  const activeTab = useRef<HTMLAnchorElement>(null);

  // On a phone the tabs scroll sideways: bring the current page's tab into view.
  useEffect(() => {
    activeTab.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 lg:hidden">
      {adsMenu.map((key) => (
        <Link
          key={key}
          ref={key === active ? activeTab : undefined}
          href={adsHref(adsPage(key).slug)}
          aria-current={key === active ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap ${
            key === active ? "bg-primary-soft font-bold text-primary-hover" : "text-text-muted"
          }`}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
