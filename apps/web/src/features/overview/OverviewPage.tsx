"use client";

import { useTranslations } from "next-intl";
import type { Kpi } from "@lulu/shared";
import { adPlatformOrder, PlatformMark, SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { CampaignDrawer } from "@/features/campaigns/CampaignDrawer";
import { CampaignTable } from "@/features/campaigns/CampaignTable";
import { useCampaigns } from "@/features/campaigns/useCampaigns";
import { LineChart, MiniBars } from "./charts";
import { SignalCard } from "./SignalCard";

const RANGE_DAYS = 30;
const DAY_MS = 86_400_000;
// Lines and mini bars from the design CSS (.spend-line, .revenue-line, .ads-sparkline).
const lines = { spend: "#7163e8", revenue: "#32c9b4" } as const;
const bars = { spend: "#dddafb", revenue: "#d8ebfa", leads: "#d7f2e8", roas: "#f8e4d0" } as const;

export function OverviewPage() {
  const t = useTranslations("overview");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const overview = useApi(() => api.overview.get(RANGE_DAYS), []);
  const campaigns = useCampaigns();
  const data = overview.data;

  if (overview.error) {
    return (
      <>
        <PageHeader page="overview" />
        <Card>
          <EmptyState icon="!" title={errorMessage(overview.error)} action={<Button variant="outline" onClick={overview.reload}>{tCommon("retry")}</Button>} />
        </Card>
      </>
    );
  }

  const money = (amount: number) => (data ? format.money({ amount, currency: data.currency }) : "");
  const compactMoney = (amount: number) => (data ? format.compactMoney({ amount, currency: data.currency }) : "");
  const changeNote = (kpi: Kpi) =>
    kpi.change === null ? (
      <em className="text-text-subtle not-italic">{t("noChange")}</em>
    ) : (
      <>
        <b className={kpi.change >= 0 ? "text-success" : "text-[#c2413d]"}>
          {kpi.change >= 0 ? "↗" : "↘"} {format.signedPercent(kpi.change)}
        </b>{" "}
        <em className="text-text-subtle not-italic">{t("vsLastPeriod")}</em>
      </>
    );

  const kpis = data
    ? [
        { key: "spend", label: t("kpi.spend"), value: money(data.spend.value), kpi: data.spend },
        { key: "revenue", label: t("kpi.revenue"), value: money(data.revenue.value), kpi: data.revenue },
        { key: "leads", label: t("kpi.leads"), value: format.number(data.leads.value), kpi: data.leads },
        { key: "roas", label: t("kpi.roas"), value: t("roasValue", { value: format.decimal(data.roas.value) }), kpi: data.roas },
      ]
    : [];

  // Five evenly spaced dates across the range for the chart's x axis.
  const labels = data
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => format.dayMonth(new Date(Date.parse(`${data.endDate}T00:00:00Z`) - Math.round((1 - f) * (data.rangeDays - 1)) * DAY_MS)))
    : [];

  return (
    <>
      <PageHeader page="overview" />

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("kpiLabel")}>
        {data
          ? kpis.map((k) => (
              <article key={k.key} className="relative min-h-[144px] overflow-hidden rounded-[14px] border border-[#e8e7f0] bg-surface px-[19px] py-[18px] shadow-[0_8px_30px_#23234307]">
                <span className="flex items-center justify-between text-[10px] text-[#888a9c]">
                  {k.label}
                  <b className="cursor-help text-[11px] font-normal text-[#bcbdc9]" title={t(`kpiInfo.${k.key}`, { days: data.rangeDays })} aria-label={t(`kpiInfo.${k.key}`, { days: data.rangeDays })}>
                    ⓘ
                  </b>
                </span>
                <strong className="mt-[13px] block text-[25px] font-semibold tracking-[-0.05em] text-[#24253f]" data-testid={`kpi-${k.key}`}>
                  {k.value}
                </strong>
                <small className="mt-[5px] block pr-20 text-[10px] font-semibold">{changeNote(k.kpi)}</small>
                <MiniBars values={k.kpi.trend} colour={bars[k.key as keyof typeof bars]} />
              </article>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[144px] rounded-[14px]" />)}
      </section>

      <section className="mb-[26px] grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(285px,0.78fr)]">
        <article className="min-h-[368px] rounded-[14px] border border-[#e8e7f0] bg-surface px-[23px] py-[22px] shadow-[0_8px_30px_#23234307]">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("performance.eyebrow")}</span>
          <h2 className="mt-1.5 mb-1 text-[16px] font-medium tracking-[-0.03em] text-[#252641]">{t("performance.title")}</h2>
          <p className="text-[12px] text-[#8b8c9c]">{t("performance.description")}</p>
          <div className="mt-7 mb-3.5 flex items-center gap-5 text-[10px] text-[#88899a]">
            <span className="flex items-center gap-1.5">
              <i className="size-[7px] rounded-full" style={{ background: lines.spend }} aria-hidden />
              {t("performance.spend")}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-[7px] rounded-full" style={{ background: lines.revenue }} aria-hidden />
              {t("performance.revenue")}
            </span>
            <b className="ml-auto font-medium text-[#9c9dad]">{t("performance.range", { days: RANGE_DAYS })}</b>
          </div>
          {data ? (
            <LineChart
              title={t("performance.chartLabel")}
              series={[
                { values: data.revenue.trend, colour: lines.revenue },
                { values: data.spend.trend, colour: lines.spend },
              ]}
              labels={labels}
              formatY={compactMoney}
            />
          ) : (
            <Skeleton className="h-[230px] w-full" />
          )}
        </article>
        <SignalCard overview={data} />
      </section>

      <SectionHeading
        eyebrow={t("channels.eyebrow")}
        title={t("channels.title")}
        action={<Link href="/ads/integrations" className="text-[11px] font-extrabold text-primary-hover hover:underline">{t("channels.manage")} →</Link>}
      />
      <section className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[...(data?.platforms ?? [])].sort((a, b) => adPlatformOrder.indexOf(a.platform) - adPlatformOrder.indexOf(b.platform)).map((p) => (
          <article key={p.platform} className="flex min-h-[116px] items-start gap-[11px] rounded-[13px] border border-[#e8e7f0] bg-surface p-4 shadow-[0_8px_25px_#23234305]">
            <PlatformMark platform={p.platform} />
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-text-strong">
                {tPlatform(`${p.platform}.name`)}
                {p.connected && <span className="size-1.5 rounded-full bg-[#67be8e]" aria-label={t("channels.connected")} />}
              </h3>
              <p className="mt-0.5 truncate text-[9px] text-text-subtle">{tPlatform(`${p.platform}.detail`)}</p>
              <small className="mt-3 block text-[9px] font-semibold text-text-strong">
                {p.connected ? t("channels.campaigns", { count: p.campaigns }) : t("channels.notConnected")}
              </small>
            </div>
            <Link
              href="/ads/integrations"
              className={`mt-0.5 rounded-[9px] px-[9px] py-[7px] text-[9px] font-semibold whitespace-nowrap ${p.connected ? "bg-[#f2f1ff] text-[#5f60a4]" : "border border-[#dad8ec] bg-surface text-text-strong hover:bg-[#f7f5ff]"}`}
            >
              {p.connected ? t("channels.manageOne") : t("channels.connect")}
            </Link>
          </article>
        ))}
      </section>

      <SectionHeading
        eyebrow={t("workspace.eyebrow")}
        title={t("workspace.title")}
        action={<Link href="/ads/campaigns" className="text-[11px] font-extrabold text-primary-hover hover:underline">{t("workspace.viewAll")} →</Link>}
      />
      <CampaignTable rows={campaigns.rows} loading={campaigns.loading} filter={campaigns.filter} onFilterChange={campaigns.setFilter} onOpen={campaigns.setOpen} />
      <CampaignDrawer campaign={campaigns.open} creatives={campaigns.creatives} onClose={() => campaigns.setOpen(null)} onChanged={campaigns.onChanged} />
    </>
  );
}
