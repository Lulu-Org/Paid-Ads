"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SyncRun } from "@lulu/shared";
import { Button, Card, Pill, SkeletonRows, useToast } from "@/components/ui";
import { HealthCard, SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { adsHref } from "@/config/navigation";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

const statusTone: Record<SyncRun["status"], "success" | "info" | "warning"> = {
  succeeded: "success",
  queued: "info",
  running: "info",
  retry_queued: "warning",
  failed: "warning",
};

// Design: "Operations". Sync health, every provider job, incidents with retries, webhooks and
// reconciliation, so nothing fails silently.
export function OperationsPage() {
  const t = useTranslations("operations");
  const tPlatform = useTranslations("platforms");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const summary = useApi(() => api.operations.summary(), []);
  const runs = useApi(() => api.operations.syncRuns(), []);
  const campaigns = useApi(() => api.campaigns.list({ pageSize: 100 }), []);
  const [busy, setBusy] = useState<string | null>(null);
  const data = summary.data;

  const campaignName = (id: string | null) => (id ? campaigns.data?.data.find((c) => c.id === id)?.name : undefined);

  const retry = async (incidentId: string) => {
    setBusy(incidentId);
    try {
      await api.operations.retry(incidentId);
      toast(t("incidents.retried"));
      summary.reload();
      runs.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };

  const reconcile = async () => {
    setBusy("reconcile");
    try {
      await api.operations.reconcile();
      toast(t("reconcile.done"));
      summary.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader page="operations" />
      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard
          tone="success"
          icon="✓"
          label={t("health.label")}
          value={data ? t(data.healthy ? "health.healthy" : "health.unhealthy") : "–"}
          note={
            data
              ? t("health.note", {
                  count: data.providers,
                  time: data.lastSyncAt ? format.relative(data.lastSyncAt) : "–",
                })
              : "–"
          }
        />
        <HealthCard
          tone="info"
          icon="↻"
          label={t("jobs.label")}
          value={data ? format.number(data.jobsToday) : "–"}
          note={data ? t("jobs.note", { rate: format.percent(data.successRate) }) : "–"}
        />
        <HealthCard
          tone="warning"
          icon="!"
          label={t("attention.label")}
          value={data ? t("attention.value", { count: data.incidents.length }) : "–"}
          note={t("attention.note")}
        />
      </section>

      <Card className="mt-5">
        <SectionHeading
          eyebrow={t("jobs.eyebrow")}
          title={t("jobs.title")}
          description={t("jobs.description")}
          action={
            <Button variant="outline" onClick={() => runs.reload()}>
              {t("jobs.refresh")}
            </Button>
          }
        />
        {runs.loading && !runs.data ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead className="text-[9px] tracking-[0.12em] text-text-subtle uppercase">
                <tr>
                  <th className="py-2 font-black">{t("jobs.provider")}</th>
                  <th className="py-2 font-black">{t("jobs.operation")}</th>
                  <th className="py-2 font-black">{t("jobs.direction")}</th>
                  <th className="py-2 font-black">{t("jobs.status")}</th>
                  <th className="py-2 font-black">{t("jobs.lastRun")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.data?.data.map((run) => (
                  <tr key={run.id} className="border-t border-surface-muted">
                    <td className="py-3 font-semibold text-text-strong">{tPlatform(`${run.platform}.name`)}</td>
                    <td className="py-3 text-text-muted">{t(`scopes.${run.scope}`)}</td>
                    <td className="py-3 text-text-muted">{t(`directions.${run.kind}`)}</td>
                    <td className="py-3">
                      <Pill tone={statusTone[run.status]}>{t(`statuses.${run.status}`)}</Pill>
                    </td>
                    <td className="py-3 text-text-muted">{format.relative(run.finishedAt ?? run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0">
          <SectionHeading eyebrow={t("incidents.eyebrow")} title={t("incidents.title")} />
          {data?.incidents.length === 0 && <p className="text-[11px] text-text-subtle">{t("incidents.none")}</p>}
          <ul className="grid gap-2">
            {data?.incidents.map((incident) => (
              <li key={incident.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                    incident.retryAt ? "bg-warning-soft text-warning" : "bg-[#fdecea] text-[#c2413d]"
                  }`}
                >
                  {incident.retryAt ? "!" : "×"}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[11px] text-text-strong">
                    {tPlatform(`${incident.platform}.name`)} · {incident.subject}
                  </strong>
                  <small className="block text-[10px] text-text-muted">{t(`incidents.kinds.${incident.kind}`)}</small>
                  <small className="block text-[10px] font-semibold text-text-subtle">
                    {incident.retryAt
                      ? t("incidents.retryAt", { time: format.relative(incident.retryAt) })
                      : t("incidents.actionRequired")}
                  </small>
                </span>
                {incident.retryAt ? (
                  <Button variant="outline" loading={busy === incident.id} onClick={() => retry(incident.id)}>
                    {t("incidents.retry")}
                  </Button>
                ) : (
                  // A person has to act (e.g. consent mapping): send them where they can fix it.
                  <Link
                    href={adsHref(incident.kind === "auth_expired" ? "integrations" : "audiences")}
                    className="inline-flex items-center rounded-md border border-[#dad8ec] px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
                  >
                    {t("incidents.review")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="min-w-0">
          <SectionHeading eyebrow={t("webhooks.eyebrow")} title={t("webhooks.title")} />
          <ul className="grid gap-2">
            {data?.webhooks.map((hook) => (
              <li key={hook.id} className="flex items-start gap-2.5 text-[11px]">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#6259d6]" />
                <span className="min-w-0">
                  <code className="font-semibold text-text-strong">{hook.eventType}</code>
                  <small className="block text-[10px] text-text-subtle">
                    {[tPlatform(`${hook.platform}.name`), campaignName(hook.campaignId), format.relative(hook.receivedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <SectionHeading
          eyebrow={t("reconcile.eyebrow")}
          title={t("reconcile.title")}
          description={t("reconcile.description")}
          action={
            <Button loading={busy === "reconcile"} onClick={reconcile}>
              {t("reconcile.run")}
            </Button>
          }
        />
        <p className="text-[11px] text-text-muted">
          <strong className="text-[19px] font-semibold text-text-strong">{data ? format.percent(data.reconciled) : "–"}</strong>{" "}
          {t("reconcile.share")}
        </p>
      </Card>
    </>
  );
}
