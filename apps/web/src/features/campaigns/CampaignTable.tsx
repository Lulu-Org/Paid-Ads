"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { campaignStatusSchema, type AdPlatform, type CampaignListItem, type CampaignStatus } from "@lulu/shared";
import { adPlatformOrder } from "@/components/ads";
import { EmptyState, Pill, SkeletonRows } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { platformDot, statusTone } from "./status";

export type PlatformFilter = AdPlatform | "all";

// The design's campaign table: platform filter pills, then one row per campaign.
// The parent owns the rows and the filter, so the Overview and Campaigns pages share it.
export function CampaignTable({
  rows,
  loading,
  filter,
  onFilterChange,
  onOpen,
}: {
  rows: CampaignListItem[] | undefined;
  loading: boolean;
  filter: PlatformFilter;
  onFilterChange: (filter: PlatformFilter) => void;
  onOpen: (campaign: CampaignListItem) => void;
}) {
  const t = useTranslations("campaigns.table");
  const tPlatform = useTranslations("platforms");
  const tStatus = useTranslations("campaignStatus");
  const format = useFormat();

  // "+ Filter" adds a status filter on top of the platform pills.
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) =>
      (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const all = rows ?? [];
  const visible = all.filter((c) => (filter === "all" || c.platform === filter) && (!status || c.status === status));
  // Only platforms that have campaigns get a pill, like the design.
  const platforms = adPlatformOrder.filter((p) => all.some((c) => c.platform === p));

  const pill = (key: PlatformFilter, label: string, count: number) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={filter === key}
      onClick={() => onFilterChange(key)}
      className={`rounded-[7px] px-2.5 py-[7px] text-[10px] whitespace-nowrap ${
        filter === key ? "bg-[#f1efff] text-[#5f52d5]" : "text-[#9293a2] hover:bg-[#f1efff] hover:text-[#5f52d5]"
      }`}
    >
      {label}
      {key === "all" && <b className="ml-[5px] text-[9px]">{format.number(count)}</b>}
    </button>
  );

  const exportCsv = () => {
    const header = [t("campaign"), t("platform"), t("status"), t("spend"), t("budget"), t("leads"), t("cpl")];
    const lines = visible.map((c) => [
      c.name,
      tPlatform(`${c.platform}.name`),
      tStatus(c.status),
      c.totals.spend.amount,
      c.budget.amount,
      c.totals.leads,
      c.totals.cpl?.amount ?? "",
    ]);
    const csv = [header, ...lines].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `${t("fileName")}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-[14px] border border-[#e8e7f0] bg-surface p-5 shadow-[0_8px_30px_#23234307]">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 gap-[5px] overflow-x-auto" role="tablist" aria-label={t("filterLabel")}>
          {pill("all", t("all"), all.length)}
          {platforms.map((p) => pill(p, tPlatform(`${p}.name`), all.filter((c) => c.platform === p).length))}
        </div>
        <div ref={menu} className="relative mr-auto flex items-center gap-1">
          {status && (
            <span className="inline-flex items-center gap-1 rounded-[7px] bg-[#f1efff] px-2 py-[7px] text-[10px] text-[#5f52d5]">
              {tStatus(status)}
              <button type="button" onClick={() => setStatus(null)} aria-label={t("removeFilter", { filter: tStatus(status) })}>
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-[7px] px-2.5 py-[7px] text-[10px] whitespace-nowrap text-[#9293a2] hover:bg-[#f1efff] hover:text-[#5f52d5]"
          >
            ＋ {t("filter")}
          </button>
          {menuOpen && (
            <ul className="absolute top-full left-0 z-20 mt-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-raised" aria-label={t("statusFilter")}>
              {campaignStatusSchema.options.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      setMenuOpen(false);
                    }}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-[11px] hover:bg-surface-soft ${status === s ? "font-bold text-primary-hover" : "text-text-strong"}`}
                  >
                    {tStatus(s)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!visible.length}
          aria-label={t("export")}
          title={t("export")}
          className="rounded-md px-2 py-1 text-base text-text-subtle hover:bg-surface-muted disabled:opacity-40"
        >
          ⇩
        </button>
      </div>

      {loading && !rows ? (
        <div className="py-4">
          <SkeletonRows rows={4} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="relative mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {[t("campaign"), t("platform"), t("status"), t("spendBudget"), t("leads"), t("cpl")].map((h) => (
                  <th key={h} scope="col" className="border-y border-[#efedf4] bg-[#fafaff] px-3 py-3 text-left text-[9px] font-semibold tracking-[0.08em] text-[#9e9baa] uppercase">
                    {h}
                  </th>
                ))}
                <th className="border-y border-[#efedf4] bg-[#fafaff]">
                  <span className="sr-only">{t("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-surface-muted text-[10px] text-text-muted">
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onOpen(c)} className="flex items-start gap-2.5 text-left">
                      <i className="mt-1 size-2 flex-none rounded-full" style={{ background: platformDot[c.platform] }} aria-hidden />
                      <span>
                        <strong className="block text-[11px] text-text-strong hover:text-primary">{c.name}</strong>
                        <small className="mt-1 block text-[10px] text-text-faint">
                          {c.totals.spend.amount > 0 ? t("budgetUsed", { percent: format.percent(c.totals.progress) }) : t("readyToLaunch")} · {t("openDetails")}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[9px] font-medium text-[#77788d]">{tPlatform(`${c.platform}.name`)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone={statusTone[c.status]}>{tStatus(c.status)}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    <strong className="block text-[11px] text-text-strong">{format.money(c.totals.spend)}</strong>
                    <small className="block text-[10px] text-text-faint">{format.money(c.budget)}</small>
                    <i className="mt-1.5 block h-1 w-24 overflow-hidden rounded bg-[#f0eff4]" aria-hidden>
                      <em className="block h-full rounded bg-[#7065df]" style={{ width: `${c.totals.progress * 100}%` }} />
                    </i>
                  </td>
                  <td className="px-3 py-3">{c.totals.leads ? format.number(c.totals.leads) : "—"}</td>
                  <td className="px-3 py-3">{c.totals.cpl ? format.money(c.totals.cpl, 2) : "—"}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(c)}
                      aria-label={t("open", { name: c.name })}
                      className="rounded px-1.5 py-1 tracking-widest text-text-subtle hover:bg-surface-muted"
                    >
                      •••
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
