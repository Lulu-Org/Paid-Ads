"use client";

import { useTranslations } from "next-intl";
import type { AdsPageKey } from "@/config/navigation";
import { Button } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useCreateCampaign } from "@/features/campaigns/CreateCampaign";

// The design's page heading: eyebrow, the view's tagline, one line of copy, and the two actions
// every view has ("View insights", "+ Create campaign"). `actions` adds page-specific buttons first.
export function PageHeader({ page, actions }: { page: AdsPageKey; actions?: React.ReactNode }) {
  const t = useTranslations("nav");
  const tPages = useTranslations("pages");
  const createCampaign = useCreateCampaign();

  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
      <div>
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{tPages("eyebrow", { page: t(page) })}</span>
        <h1 className="mt-2 mb-1.5 text-[29px] font-semibold tracking-tight text-text">{tPages(`${page}.description`)}</h1>
        <p className="max-w-[690px] text-xs leading-relaxed text-text-muted">{tPages("subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Link
          href="/ads/reports"
          className="inline-flex items-center rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
        >
          {tPages("viewInsights")}
        </Link>
        {createCampaign && (
          <Button icon="＋" onClick={createCampaign.open}>
            {tPages("createCampaign")}
          </Button>
        )}
      </div>
    </div>
  );
}
