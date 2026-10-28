"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { attributionModelSchema, type AttributionModel } from "@lulu/shared";
import { Button, Card, Pill, SkeletonRows } from "@/components/ui";
import { HealthCard, PlatformMark, SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddEventModal } from "@/features/tracking/AddEventModal";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const lineage = ["adClick", "websiteForm", "crmLead", "calendarBooking", "revenue"] as const;

// Design: "Attribution & Data". Data quality, revenue by platform for a chosen model, event mapping,
// and where a number comes from.
export function AttributionPage() {
  const t = useTranslations("attribution");
  const tSource = useTranslations("eventSources");
  const tPlatform = useTranslations("platforms");
  const tTracking = useTranslations("tracking");
  const format = useFormat();
  const [model, setModel] = useState<AttributionModel>("data_driven");
  const attribution = useApi(() => api.attribution.get(model), [model]);
  const events = useApi(() => api.tracking.events(), []);
  const [adding, setAdding] = useState(false);
  const data = attribution.data;
  const top = Math.max(1, ...(data?.byPlatform.map((p) => p.revenue.amount) ?? [1]));

  return (
    <>
      <PageHeader page="attribution" />
      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard
          tone="success"
          icon="✓"
          label={t("quality.label")}
          value={data ? format.percent(data.dataQuality) : "–"}
          note={t("quality.note")}
        />
        <HealthCard
          tone="info"
          icon="↗"
          label={t("revenue.label")}
          value={data ? format.money(data.revenue) : "–"}
          note={t("revenue.note")}
        />
        <HealthCard
          tone="warning"
          icon="!"
          label={t("unmapped.label")}
          value={data ? tTracking("attention.value", { count: data.unmappedEvents }) : "–"}
          note={t("unmapped.note")}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0">
          <SectionHeading
            eyebrow={t("model.eyebrow")}
            title={t("model.title")}
            description={t("model.description")}
            action={
              <select
                aria-label={t("model.label")}
                value={model}
                onChange={(e) => setModel(e.target.value as AttributionModel)}
                className="rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[11px]"
              >
                {attributionModelSchema.options.map((m) => (
                  <option key={m} value={m}>
                    {t(`models.${m}`)}
                  </option>
                ))}
              </select>
            }
          />
          {attribution.loading && !data ? (
            <SkeletonRows rows={3} />
          ) : (
            <ul className="grid gap-3.5" aria-label={t("model.byPlatform")}>
              {data?.byPlatform.map((row) => (
                <li key={row.platform} className="grid gap-1.5">
                  <span className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-2">
                      <PlatformMark platform={row.platform} />
                      {tPlatform(`${row.platform}.name`)}
                    </span>
                    <b className="text-text-strong">{format.money(row.revenue)}</b>
                  </span>
                  <i className="block h-1.5 rounded-full bg-surface-muted" aria-hidden>
                    <em
                      className="block h-full rounded-full bg-[#6259d6]"
                      style={{ width: `${Math.round((row.revenue.amount / top) * 100)}%` }}
                    />
                  </i>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <SectionHeading
            eyebrow={t("mapping.eyebrow")}
            title={t("mapping.title")}
            action={
              <Button icon="＋" onClick={() => setAdding(true)}>
                {tTracking("events.add")}
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-[11px]">
              <thead className="text-[9px] tracking-[0.12em] text-text-subtle uppercase">
                <tr>
                  <th className="py-2 font-black">{tTracking("events.event")}</th>
                  <th className="py-2 font-black">{tTracking("events.source")}</th>
                  <th className="py-2 font-black">{t("mapping.value")}</th>
                  <th className="py-2 font-black">{t("mapping.health")}</th>
                </tr>
              </thead>
              <tbody>
                {events.data?.data.map((event) => (
                  <tr key={event.id} className="border-t border-surface-muted">
                    <td className="py-3 font-semibold text-text-strong">{event.name}</td>
                    <td className="py-3 text-text-muted">{tSource(event.source)}</td>
                    <td className="py-3 text-text-muted">{event.value ? format.money(event.value) : t("mapping.dynamic")}</td>
                    <td className="py-3">
                      <Pill tone={event.health === "mapped" ? "success" : "warning"}>
                        {t(`mapping.status.${event.health}`)}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <SectionHeading eyebrow={t("lineage.eyebrow")} title={t("lineage.title")} />
        <ol className="flex flex-wrap items-center gap-2 text-[11px]" aria-label={t("lineage.title")}>
          {lineage.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-surface-muted px-2.5 py-1.5 font-semibold text-text-strong">
                {t(`lineage.${step}`)}
              </span>
              {i < lineage.length - 1 && (
                <span aria-hidden className="text-text-subtle">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <AddEventModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          events.reload();
        }}
      />
    </>
  );
}
