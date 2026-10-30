"use client";

import { useTranslations } from "next-intl";
import type { Overview } from "@lulu/shared";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

// The design's dark signal card. It points at the channel with the lowest cost per lead in the
// overview range, computed from the numbers on this page; nothing is estimated or invented.
export function SignalCard({ overview }: { overview: Overview | undefined }) {
  const t = useTranslations("overview.signal");
  const tPlatform = useTranslations("platforms");
  const format = useFormat();

  const withLeads = (overview?.platforms ?? []).filter((p) => p.leads > 0 && p.spend.amount > 0);
  const best = [...withLeads].sort((a, b) => a.spend.amount / a.leads - b.spend.amount / b.leads)[0];
  const totalLeads = withLeads.reduce((sum, p) => sum + p.leads, 0);
  const totalSpend = withLeads.reduce((sum, p) => sum + p.spend.amount, 0);

  return (
    <article className="relative min-h-[320px] overflow-hidden rounded-[14px] bg-[linear-gradient(145deg,#2f295a,#413b7b_58%,#2a6682)] p-[23px] text-white shadow-[0_8px_30px_#23234307] lg:min-h-[368px]">
      <div
        aria-hidden
        className="absolute -top-[37px] -right-[29px] grid size-[142px] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_35%,#84e9ee,#6865e8_39%,#a953cb_63%,transparent_64%)] text-[23px] text-[#d9f7ff]"
      >
        ✦
      </div>
      <span className="text-[9px] font-black tracking-[0.16em] text-[#bdb7f1] uppercase">{t("eyebrow")}</span>
      {best && overview ? (
        <>
          <h2 className="mt-5 max-w-[235px] text-[21px] leading-[1.22] font-medium tracking-[-0.03em]">
            {t("title", { platform: tPlatform(`${best.platform}.name`) })}
          </h2>
          <p className="mt-[13px] mb-[22px] max-w-[260px] text-[11px] leading-[1.75] text-[#d5d3ef]">
            {t("body", {
              platform: tPlatform(`${best.platform}.name`),
              cpl: format.money({ amount: best.spend.amount / best.leads, currency: overview.currency }, 2),
              average: format.money({ amount: totalSpend / totalLeads, currency: overview.currency }, 2),
            })}
          </p>
          <Link
            href="/ads/planning"
            className="inline-flex rounded-[9px] border border-[#817cc3] bg-white/[0.07] px-[15px] py-2.5 text-[11px] font-semibold hover:bg-white/[0.13]"
          >
            {t("action")}
          </Link>
          <div className="absolute right-[22px] bottom-5 left-[23px] flex justify-between gap-3 text-[9px] text-[#b8b7dc]">
            <span>{t("sources", { count: withLeads.length })}</span>
            <span>{t("asOf", { date: format.dayMonth(overview.endDate) })}</span>
          </div>
        </>
      ) : (
        <p className="mt-5 max-w-[260px] text-[11px] leading-[1.75] text-[#d5d3ef]">{overview ? t("empty") : ""}</p>
      )}
    </article>
  );
}
