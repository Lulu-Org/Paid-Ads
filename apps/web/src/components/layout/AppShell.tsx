"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AdsTabs } from "./AdsNav";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";
import { CreateCampaignProvider } from "@/features/campaigns/CreateCampaign";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("layout");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <CreateCampaignProvider>
    <div className="flex min-h-screen bg-bg">
      <div className="sticky top-0 hidden h-screen flex-none lg:block">
        <Rail />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu")}>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative h-full w-fit">
            <Rail onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <AdsTabs />
        <div className="flex flex-1">
          <main className="mx-auto w-full max-w-[1540px] min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
    </CreateCampaignProvider>
  );
}
