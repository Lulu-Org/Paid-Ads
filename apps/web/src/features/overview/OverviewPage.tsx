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
import { LineChart, Sparkline } from "./charts";

const RANGE_DAYS = 30;
const DAY_MS = 86_400_000;
const colours = { spend: "#7065df", revenue: "#60a7de", leads: "#62be8f", roas: "#e49b6c" } as const;

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

      <section className="mb-4.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("kpiLabel")}>
        {data
          ? kpis.map((k) => (
              <Card key={k.key} className="px-[18px] py-[17px]">
                <span className="block text-[11px] text-text-muted">{k.label}</span>
                <strong className="mt-2 block text-[24px] font-semibold tracking-tight text-text" data-testid={`kpi-${k.key}`}>
                  {k.value}
                </strong>
                <small className="mt-1 block text-[10px]">{changeNote(k.kpi)}</small>
                <Sparkline values={k.kpi.trend} colour={colours[k.key as keyof typeof colours]} />
              </Card>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-[13px]" />)}
      </section>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("performance.eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("performance.title")}</h2>
            <p className="mt-1 text-[11px] text-text-muted">{t("performance.description")}</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-text-muted">
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded" style={{ background: colours.spend }} aria-hidden />{t("performance.spend")}</span>
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded" style={{ background: colours.revenue }} aria-hidden />{t("performance.revenue")}</span>
            <b className="text-text-strong">{t("performance.range", { days: RANGE_DAYS })}</b>
          </div>
        </div>
        {data ? (
          <LineChart
            title={t("performance.chartLabel")}
            series={[
              { values: data.revenue.trend, colour: colours.revenue },
              { values: data.spend.trend, colour: colours.spend },
            ]}
            labels={labels}
            formatY={compactMoney}
          />
        ) : (
          <Skeleton className="mt-4 h-[220px] w-full" />
        )}
      </Card>

      <SectionHeading
        eyebrow={t("channels.eyebrow")}
        title={t("channels.title")}
        action={<Link href="/ads/integrations" className="text-[11px] font-extrabold text-primary-hover hover:underline">{t("channels.manage")} →</Link>}
      />
      <section className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[...(data?.platforms ?? [])].sort((a, b) => adPlatformOrder.indexOf(a.platform) - adPlatformOrder.indexOf(b.platform)).map((p) => (
          <Card key={p.platform} className="flex items-start gap-3">
            <PlatformMark platform={p.platform} />
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-text-strong">
                {tPlatform(`${p.platform}.name`)}
                {p.connected && <span className="size-1.5 rounded-full bg-[#67be8e]" aria-label={t("channels.connected")} />}
              </h3>
              <p className="mt-0.5 text-[10px] text-text-subtle">{tPlatform(`${p.platform}.detail`)}</p>
              <small className="mt-2 block text-[10px] text-text-muted">
                {p.connected ? t("channels.campaigns", { count: p.campaigns }) : t("channels.notConnected")}
              </small>
            </div>
            <Link
              href="/ads/integrations"
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${p.connected ? "text-text-muted hover:bg-surface-muted" : "border border-[#dad8ec] text-primary-hover hover:bg-[#f7f5ff]"}`}
            >
              {p.connected ? t("channels.manageOne") : t("channels.connect")}
            </Link>
          </Card>
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
