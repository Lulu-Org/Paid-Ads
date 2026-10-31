"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, SkeletonRows, useToast } from "@/components/ui";
import { HealthCard, SectionHeading, StatusText } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AddEventModal } from "./AddEventModal";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";

// Design: "Tracking". Tracking health, the conversion events, and a UTM builder for tracking links.
export function TrackingPage() {
  const t = useTranslations("tracking");
  const tSource = useTranslations("eventSources");
  const format = useFormat();
  const health = useApi(() => api.tracking.health(), []);
  const events = useApi(() => api.tracking.events(), []);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader page="tracking" />
      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard
          tone="success"
          icon="✓"
          label={t("health.label")}
          value={health.data ? t(health.data.healthy ? "health.healthy" : "health.unhealthy") : "–"}
          note={t("health.note")}
        />
        <HealthCard
          tone="info"
          icon="↗"
          label={t("today.label")}
          value={health.data ? format.number(health.data.eventsToday) : "–"}
          note={
            health.data?.changeVsYesterday != null
              ? t("today.note", { change: format.signedPercent(health.data.changeVsYesterday) })
              : "–"
          }
        />
        <HealthCard
          tone="warning"
          icon="!"
          label={t("attention.label")}
          value={health.data ? t("attention.value", { count: health.data.needsAttention }) : "–"}
          note={t("attention.note")}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <SectionHeading
            eyebrow={t("events.eyebrow")}
            title={t("events.title")}
            action={
              <Button icon="＋" onClick={() => setAdding(true)}>
                {t("events.add")}
              </Button>
            }
          />
          {events.loading && !events.data ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-[11px]">
                <thead className="text-[8px] font-bold tracking-[0.08em] text-[#a0a1ad]">
                  <tr>
                    <th className="py-2 font-black">{t("events.event")}</th>
                    <th className="py-2 font-black">{t("events.source")}</th>
                    <th className="py-2 font-black">{t("events.lastReceived")}</th>
                    <th className="py-2 font-black">{t("events.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.data?.data.map((event) => (
                    <tr key={event.id} className="border-t border-surface-muted">
                      <td className="py-3 font-semibold text-text-strong">{event.name}</td>
                      <td className="py-3 text-text-muted">{tSource(event.source)}</td>
                      <td className="py-3 text-text-muted">
                        {event.lastReceivedAt ? format.relative(event.lastReceivedAt) : t("events.never")}
                      </td>
                      <td className="py-3">
                        <StatusText tone={event.health === "mapped" ? "success" : "warning"}>
                          {t(`eventHealth.${event.health}`)}
                        </StatusText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <UtmBuilder />
      </div>

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

// Lower case, letters, digits and underscores, as UTM values usually are.
const utmValue = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Builds a tracking link so every click stays attributable (design: "UTM builder"). */
export function UtmBuilder() {
  const t = useTranslations("tracking.utm");
  const toast = useToast();
  const [base, setBase] = useState("https://lulu.ai/");
  const [source, setSource] = useState("google");
  const [campaign, setCampaign] = useState("spring_launch_berlin");
  const [content, setContent] = useState("search_rsa_b");

  const link = useMemo(() => {
    try {
      const url = new URL(base.trim());
      const params: [string, string][] = [
        ["utm_source", utmValue(source)],
        ["utm_campaign", utmValue(campaign)],
        ["utm_content", utmValue(content)],
      ];
      for (const [key, value] of params) if (value) url.searchParams.set(key, value);
      return url.toString();
    } catch {
      return null;
    }
  }, [base, source, campaign, content]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast(t("copied"));
    } catch {
      toast(t("copyFailed"), "error");
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-extrabold text-neutral">{label}</span>
      <input className={inputClass} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <Card className="min-w-0 self-start">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <div className="grid gap-3">
        {field(t("url"), base, setBase)}
        {field(t("source"), source, setSource)}
        {field(t("campaign"), campaign, setCampaign)}
        {field(t("content"), content, setContent)}
        <output
          aria-label={t("link")}
          className="block rounded-md bg-surface-muted px-3 py-2.5 font-mono text-[10px] break-all text-text-muted"
        >
          {link ?? t("invalidUrl")}
        </output>
        <Button variant="outline" onClick={copy} disabled={!link}>
          {t("copy")}
        </Button>
      </div>
    </Card>
  );
}
