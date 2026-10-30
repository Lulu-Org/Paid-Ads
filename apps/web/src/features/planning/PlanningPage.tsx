"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PlanChannel, Planning } from "@lulu/shared";
import { AdsCard, CardHeader, KpiTile, StepList } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { ScenarioModal } from "./ScenarioModal";

const DAY_MS = 86_400_000;

export function PlanningPage() {
  const t = useTranslations("planning");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const planning = useApi(() => api.planning.get(), []);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [saved, setSaved] = useState<Planning | null>(null);
  const data = saved ?? planning.data;

  if (planning.error) {
    return (
      <>
        <PageHeader page="planning" />
        <Card>
          <EmptyState icon="!" title={errorMessage(planning.error)} action={<Button variant="outline" onClick={planning.reload}>{tCommon("retry")}</Button>} />
        </Card>
      </>
    );
  }

  const target = (c: PlanChannel) =>
    c.target.metric === "roas"
      ? t("target.roas", { value: format.decimal(c.target.value) })
      : c.target.metric === "cpl"
        ? t("target.cpl", { value: format.money({ amount: c.target.value, currency: c.planned.currency }) })
        : t("target.leads", { value: format.number(c.target.value) });

  const leadChange = data && data.previousTargetLeads ? (data.targetLeads - data.previousTargetLeads) / data.previousTargetLeads : null;
  const reviewDays = data?.plan.nextReviewAt ? Math.max(0, Math.ceil((Date.parse(data.plan.nextReviewAt) - Date.now()) / DAY_MS)) : null;

  return (
    <>
      <PageHeader page="planning" />

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <KpiTile
              label={t("kpi.planned")}
              value={format.money(data.limit)}
              note={t("kpi.allocated", { share: format.percent(data.allocatedShare) })}
              testId="planning-limit"
            />
            <KpiTile
              label={t("kpi.targetLeads")}
              value={format.number(data.targetLeads)}
              note={leadChange === null ? t("kpi.noPreviousPlan") : t("kpi.vsLastPlan", { change: format.signedPercent(leadChange) })}
              noteTone={leadChange === null ? "neutral" : leadChange >= 0 ? "positive" : "negative"}
              testId="planning-leads"
            />
            <KpiTile
              label={t("kpi.forecastRevenue")}
              value={format.compactMoney(data.forecastRevenue)}
              note={data.forecastRoas === null ? t("kpi.noForecast") : t("kpi.forecastRoas", { value: format.decimal(data.forecastRoas) })}
              noteTone={data.forecastRoas === null ? "neutral" : "positive"}
              testId="planning-revenue"
            />
            <KpiTile
              label={t("kpi.nextReview")}
              value={reviewDays === null ? "—" : t("kpi.days", { count: reviewDays })}
              note={data.plan.nextReviewNote ?? undefined}
              noteTone="neutral"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[144px] rounded-[14px]" />)
        )}
      </section>

      <section className="mb-4 grid gap-[15px] lg:grid-cols-[minmax(0,1.6fr)_minmax(290px,0.8fr)]">
        <AdsCard className="p-[21px]">
          <CardHeader
            eyebrow={data ? t("budget.eyebrow", { month: format.monthYear(`${data.plan.month}-01T00:00:00Z`) }) : t("budget.eyebrowEmpty")}
            title={t("budget.title")}
            description={t("budget.description")}
            action={<Button onClick={() => setScenarioOpen(true)} disabled={!data}>{t("budget.saveScenario")}</Button>}
          />
          <div className="mt-[27px] grid gap-[17px]">
            {data?.plan.channels.map((c) => {
              const row = data.channels.find((r) => r.platform === c.platform);
              return (
                <div key={c.platform}>
                  <span className="flex justify-between text-[10px] text-[#5d5e70]">
                    {tPlatform(`${c.platform}.name`)}
                    <b className="text-[11px] text-[#33344a]">{format.money(c.planned)}</b>
                  </span>
                  <i className="mt-2 mb-[5px] block h-[7px] overflow-hidden rounded-[5px] bg-[#efedf7]" aria-hidden>
                    <em className="block h-full rounded-[5px] bg-gradient-to-r from-[#6c5de3] to-[#67d5d6]" style={{ width: `${(row?.share ?? 0) * 100}%` }} />
                  </i>
                  <small className="text-[9px] text-[#9c9da9]">
                    {t("budget.share", { share: format.percent(row?.share ?? 0) })} · {target(c)}
                  </small>
                </div>
              );
            })}
          </div>
        </AdsCard>

        <AdsCard className="p-[21px]">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("steps.eyebrow")}</span>
          <h2 className="mt-[7px] mb-[18px] text-[16px] font-medium tracking-[-0.03em] text-[#292a43]">{t("steps.title")}</h2>
          {data && <StepList steps={data.plan.steps} />}
          {data && (
            <p className="text-[10px] text-[#8b8c9c]">
              {t("steps.status")} <b className="text-[#4c4d60]">{t(`status.${data.plan.status}`)}</b>
            </p>
          )}
        </AdsCard>
      </section>

      {data && (
        <AdsCard className="mb-4 p-[21px]">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("logic.eyebrow")}</span>
          <h2 className="mt-[7px] mb-4 text-[16px] font-medium tracking-[-0.03em] text-[#292a43]">{t("logic.title")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {(["goal", "constraint", "signal"] as const).map((key) => (
              <div key={key} className="rounded-[10px] border border-[#ecebf2] bg-[#fcfcfe] p-3.5">
                <strong className="text-[9px] tracking-[0.08em] text-[#5b51d2] uppercase">{t(`logic.${key}`)}</strong>
                <p className="mt-[7px] text-[10px] leading-[1.6] text-[#77788a]">{data.plan.rationale[key]}</p>
              </div>
            ))}
          </div>
        </AdsCard>
      )}

      {data && (
        <ScenarioModal
          open={scenarioOpen}
          planning={data}
          onClose={() => setScenarioOpen(false)}
          onSaved={(result) => {
            setSaved(result);
            setScenarioOpen(false);
          }}
        />
      )}
    </>
  );
}
