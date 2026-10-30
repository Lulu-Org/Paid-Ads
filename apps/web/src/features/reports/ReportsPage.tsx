"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AdPlatform, Report } from "@lulu/shared";
import { adPlatformOrder, AdsCard, CardHeader, KpiTile } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, ConfirmDialog, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { ReportModal } from "./ReportModal";

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DEFAULT_DAYS = 30;

export type ReportRange = { kind: "last"; days: number } | { kind: "custom"; from: string; to: string };

/** Turns the range into dates. "Last N days" ends on the newest day with synced metrics. */
export function resolveRange(range: ReportRange, endDate: string) {
  if (range.kind === "custom") return { from: range.from, to: range.to };
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return { from: isoDay(end - (range.days - 1) * DAY_MS), to: endDate };
}

export function ReportsPage() {
  const t = useTranslations("reports");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [range, setRange] = useState<ReportRange>({ kind: "last", days: DEFAULT_DAYS });
  const [platforms, setPlatforms] = useState<AdPlatform[]>([]);
  const [popover, setPopover] = useState<"range" | "filter" | null>(null);
  const [draftRange, setDraftRange] = useState({ from: "", to: "" });
  const [modal, setModal] = useState<"schedule" | "custom" | null>(null);
  const [toDelete, setToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // The newest synced day anchors "Last N days".
  const anchor = useApi(() => api.overview.get(1), []);
  const endDate = anchor.data?.endDate;
  const dates = endDate ? resolveRange(range, endDate) : null;
  const run = useApi(
    () => (dates ? api.reports.run({ ...dates, platforms }) : new Promise<never>(() => {})),
    [dates?.from, dates?.to, platforms.join(",")],
  );
  const saved = useApi(() => api.reports.list(), []);

  useEffect(() => {
    if (!popover) return;
    const close = (e: MouseEvent | KeyboardEvent) =>
      (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) && setPopover(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [popover]);

  const pill = (active: boolean) =>
    `rounded-[7px] px-2.5 py-[7px] text-[10px] whitespace-nowrap ${active ? "bg-[#f1efff] text-[#5f52d5]" : "text-[#9293a2] hover:bg-[#f1efff] hover:text-[#5f52d5]"}`;
  const data = run.data;
  const change = (value: number | null, inverse = false, points = false) =>
    value === null ? (
      <span className="font-normal text-[#a2a3b2]">{t("noComparison")}</span>
    ) : (
      <span className={(value >= 0) !== inverse ? "text-[#2b956f]" : "text-[#c2413d]"}>
        {value >= 0 ? "↗" : "↘"} {points ? t("points", { value: format.decimal(Math.abs(value) * 100) }) : format.percent(Math.abs(value))}
      </span>
    );

  const deleteReport = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.reports.remove(toDelete.id);
      toast(t("saved.deleted", { name: toDelete.name }));
      setToDelete(null);
      saved.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  const describe = (r: Report) =>
    [
      r.view.platforms.length ? r.view.platforms.map((p) => tPlatform(`${p}.name`)).join(", ") : t("allChannels"),
      t("lastDays", { count: r.view.rangeDays }),
      r.schedule ? t(`schedule.${r.schedule === "0 8 1 * *" ? "monthly" : r.schedule === "0 8 * * 1" ? "weekly" : "custom"}`) : t("schedule.onDemand"),
    ].join(" · ");

  return (
    <>
      <PageHeader page="reports" />

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div ref={box} className="relative flex flex-wrap items-center gap-[5px]">
          <button type="button" className={pill(range.kind === "last" && range.days === DEFAULT_DAYS)} onClick={() => setRange({ kind: "last", days: DEFAULT_DAYS })}>
            {t("lastDays", { count: DEFAULT_DAYS })}
          </button>
          <button
            type="button"
            aria-expanded={popover === "range"}
            className={pill(range.kind === "custom")}
            onClick={() => {
              if (dates) setDraftRange(dates);
              setPopover(popover === "range" ? null : "range");
            }}
          >
            {range.kind === "custom" ? format.dateRange(`${range.from}T00:00:00Z`, `${range.to}T00:00:00Z`) : t("customRange")}
          </button>
          {platforms.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-[7px] bg-[#f1efff] px-2 py-[7px] text-[10px] text-[#5f52d5]">
              {tPlatform(`${p}.name`)}
              <button type="button" onClick={() => setPlatforms(platforms.filter((x) => x !== p))} aria-label={t("removeFilter", { filter: tPlatform(`${p}.name`) })}>
                ✕
              </button>
            </span>
          ))}
          <button type="button" aria-expanded={popover === "filter"} className={pill(false)} onClick={() => setPopover(popover === "filter" ? null : "filter")}>
            ＋ {t("filter")}
          </button>

          {popover === "range" && (
            <form
              className="absolute top-full left-0 z-20 mt-1 grid w-64 gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-raised"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draftRange.from || !draftRange.to || draftRange.to < draftRange.from) return;
                setRange({ kind: "custom", ...draftRange });
                setPopover(null);
              }}
            >
              <label className="grid gap-1 text-[10px] font-extrabold text-neutral">
                {t("from")}
                <input type="date" value={draftRange.from} onChange={(e) => setDraftRange({ ...draftRange, from: e.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-[11px] font-normal text-text" />
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold text-neutral">
                {t("to")}
                <input type="date" value={draftRange.to} onChange={(e) => setDraftRange({ ...draftRange, to: e.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-[11px] font-normal text-text" />
              </label>
              {draftRange.from && draftRange.to && draftRange.to < draftRange.from && <span className="text-[10px] text-[#c2413d]">{t("rangeInvalid")}</span>}
              <Button type="submit">{t("apply")}</Button>
            </form>
          )}
          {popover === "filter" && (
            <ul className="absolute top-full left-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface p-1 shadow-raised" aria-label={t("filterLabel")}>
              {adPlatformOrder.map((p) => (
                <li key={p}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-text-strong hover:bg-surface-soft">
                    <input
                      type="checkbox"
                      className="accent-[#6259d6]"
                      checked={platforms.includes(p)}
                      onChange={() => setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p])}
                    />
                    {tPlatform(`${p}.name`)}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button onClick={() => setModal("schedule")} disabled={!dates}>{t("scheduleReport")}</Button>
      </section>

      {run.error || anchor.error ? (
        <Card>
          <EmptyState
            icon="!"
            title={errorMessage(run.error ?? anchor.error)}
            action={<Button variant="outline" onClick={() => (anchor.error ? anchor.reload() : run.reload())}>{tCommon("retry")}</Button>}
          />
        </Card>
      ) : (
        <>
          <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={run.loading}>
            {data ? (
              <>
                <KpiTile label={t("kpi.revenue")} value={format.money({ amount: data.revenue.value, currency: data.currency })} note={change(data.revenue.change)} testId="report-revenue" />
                <KpiTile label={t("kpi.leads")} value={format.number(data.leads.value)} note={change(data.leads.change)} testId="report-leads" />
                <KpiTile label={t("kpi.conversionRate")} value={format.percent(data.conversionRate.value)} note={change(data.conversionRate.change, false, true)} />
                <KpiTile label={t("kpi.costPerLead")} value={format.money({ amount: data.costPerLead.value, currency: data.currency }, 2)} note={change(data.costPerLead.change, true)} />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[144px] rounded-[14px]" />)
            )}
          </section>

          <AdsCard className="mb-4 p-[21px]">
            <CardHeader
              eyebrow={t("comparison.eyebrow")}
              title={t("comparison.title")}
              description={dates ? format.dateRange(`${dates.from}T00:00:00Z`, `${dates.to}T00:00:00Z`) : undefined}
              action={<Button variant="outline" onClick={() => setModal("custom")} disabled={!dates}>{t("customReport")}</Button>}
            />
            <div className="relative mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left text-[9px] text-[#626377]">
                <thead>
                  <tr className="text-[8px] font-bold tracking-[0.08em] text-[#a0a1ad]">
                    {[t("comparison.channel"), t("comparison.spend"), t("comparison.leads"), t("comparison.conversions"), t("comparison.roas")].map((h, i) => (
                      <th key={h} className={`pb-[11px] font-bold ${i === 4 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...(data?.channels ?? [])].sort((a, b) => adPlatformOrder.indexOf(a.platform) - adPlatformOrder.indexOf(b.platform)).map((c) => (
                    <tr key={c.platform} className="border-t border-[#efeff3]">
                      <td className="py-[11px]">{tPlatform(`${c.platform}.name`)}</td>
                      <td className="py-[11px]">{format.money(c.spend)}</td>
                      <td className="py-[11px]">{c.leads ? format.number(c.leads) : "—"}</td>
                      <td className="py-[11px]">{c.conversions ? format.number(c.conversions) : "—"}</td>
                      <td className="py-[11px] text-right">
                        <strong className="text-[#3d3e54]">
                          {c.roas !== null ? t("roasValue", { value: format.decimal(c.roas) }) : c.campaigns ? t("comparison.noSpend") : t("comparison.noCampaigns")}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdsCard>

          <AdsCard className="mb-4 p-[21px]">
            <CardHeader eyebrow={t("saved.eyebrow")} title={t("saved.title")} />
            {saved.data?.data.length ? (
              <ul className="mt-4">
                {saved.data.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efeff3] py-3">
                    <span className="min-w-0">
                      <strong className="block text-[11px] font-semibold text-text-strong">{r.name}</strong>
                      <small className="mt-0.5 block text-[10px] text-text-subtle">{describe(r)}</small>
                    </span>
                    <span className="flex gap-1.5">
                      <Button
                        variant="outline"
                        className="!px-2.5 !py-1.5 !text-[10px]"
                        onClick={() => {
                          setRange({ kind: "last", days: r.view.rangeDays });
                          setPlatforms(r.view.platforms);
                        }}
                      >
                        {t("saved.open")}
                      </Button>
                      <Button variant="ghost" className="!px-2.5 !py-1.5 !text-[10px]" onClick={() => setToDelete(r)}>
                        {t("saved.delete")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("saved.empty")} />
            )}
          </AdsCard>
        </>
      )}

      {modal && (
        <ReportModal
          kind={modal}
          view={{ platforms, rangeDays: range.kind === "last" ? range.days : Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1 }}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            saved.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t("saved.deleteTitle")}
        message={t("saved.deleteMessage", { name: toDelete?.name ?? "" })}
        confirmLabel={t("saved.delete")}
        busy={deleting}
        onConfirm={deleteReport}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
