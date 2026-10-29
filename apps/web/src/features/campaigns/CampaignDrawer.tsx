"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Campaign, CampaignListItem, Creative } from "@lulu/shared";
import { Button, ConfirmDialog, Drawer, Pill, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { statusTone } from "./status";

const stepMark = { done: "✓", current: "•", upcoming: "○" } as const;
const stepStyle = {
  done: "bg-success-soft text-success",
  current: "bg-primary-soft text-primary",
  upcoming: "bg-surface-muted text-text-faint",
} as const;

const creativeIcon: Partial<Record<Creative["type"], string>> = { video: "▶", document: "PDF", lead_form: "☷" };

export function CampaignDrawer({
  campaign,
  creatives,
  onClose,
  onChanged,
}: {
  campaign: CampaignListItem | null;
  creatives: Creative[];
  onClose: () => void;
  onChanged: (campaign: Campaign) => void;
}) {
  const t = useTranslations("campaigns.drawer");
  const tPlatform = useTranslations("platforms");
  const tStatus = useTranslations("campaignStatus");
  const tCreative = useTranslations("campaigns.creativeTypes");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = campaign?.id;
  const detail = useApi(() => (id ? api.campaigns.get(id) : Promise.resolve(null)), [id]);

  if (!campaign) return null;
  const status = campaign.status;
  const canToggle = status === "live" || status === "paused";
  const totals = detail.data?.totals ?? campaign.totals;
  const dash = "—";

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = status === "live" ? await api.campaigns.pause(campaign.id) : await api.campaigns.resume(campaign.id);
      toast(t(updated.status === "paused" ? "paused" : "resumed", { name: campaign.name }));
      onChanged(updated);
      setConfirm(false);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const schedule = campaign.startAt
    ? campaign.endAt
      ? t("scheduleRange", { start: format.date(campaign.startAt), end: format.date(campaign.endAt) })
      : t("scheduleFrom", { start: format.date(campaign.startAt) })
    : t("scheduleNone");

  const stats: [string, string][] = [
    [t("impressions"), totals.impressions ? format.number(totals.impressions) : dash],
    [t("clicks"), totals.clicks ? format.number(totals.clicks) : dash],
    [t("ctr"), totals.ctr !== null ? format.percent(totals.ctr) : dash],
    [t("conversions"), totals.conversions ? format.number(totals.conversions) : dash],
    [t("revenue"), totals.revenue.amount ? format.money(totals.revenue) : dash],
    [t("cpl"), totals.cpl ? format.money(totals.cpl, 2) : dash],
  ];

  const used = creatives.filter((c) => detail.data?.creativeIds.includes(c.id));

  return (
    <>
      <Drawer open onClose={onClose} eyebrow={t("eyebrow", { platform: tPlatform(`${campaign.platform}.name`) })} title={campaign.name}>
        <p className="-mt-3 text-[11px] text-text-muted">{campaign.objective}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <Pill tone={statusTone[status]}>{tStatus(status)}</Pill>
          {canToggle && (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              {status === "live" ? `Ⅱ ${t("pause")}` : `▶ ${t("resume")}`}
            </Button>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-surface-soft p-3">
              <dt className="text-[9px] text-text-subtle">{label}</dt>
              <dd className="mt-1 text-[13px] font-semibold text-text-strong">{value}</dd>
            </div>
          ))}
        </dl>

        <Section eyebrow={t("audienceEyebrow")} title={t("audience")}>
          <p className="text-[11px] text-text-strong">{campaign.audienceSummary ?? t("noAudience")}</p>
        </Section>

        <Section eyebrow={t("planEyebrow")} title={t("plan")} meta={schedule}>
          {detail.loading && !detail.data ? (
            <Skeleton className="h-16 w-full" />
          ) : detail.data?.plan.length ? (
            <ol className="grid gap-1">
              {detail.data.plan.map((step) => (
                <li key={step.id} className="flex items-start gap-2.5 border-b border-surface-muted py-2.5 last:border-b-0">
                  <span aria-hidden className={`grid size-[22px] flex-none place-items-center rounded-full text-[10px] font-black ${stepStyle[step.status]}`}>
                    {stepMark[step.status]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px] text-text-strong">{step.label}</strong>
                    <small className="mt-0.5 block text-[10px] text-text-subtle">{step.detail}</small>
                  </span>
                  <b className="text-[9px] text-text-faint">{t(`step.${step.status}`)}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-text-subtle">{t("noPlan")}</p>
          )}
        </Section>

        <Section eyebrow={t("reasonEyebrow")} title={t("reason")}>
          <p className="text-[11px] leading-relaxed text-text-muted">{campaign.rationale ?? t("noReason")}</p>
          {campaign.nextStep && (
            <div className="mt-3 flex gap-2.5 rounded-lg bg-primary-soft p-3">
              <span aria-hidden className="text-primary">✦</span>
              <div>
                <strong className="block text-[11px] text-primary-hover">{t("nextStep")}</strong>
                <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{campaign.nextStep}</p>
              </div>
            </div>
          )}
        </Section>

        <Section eyebrow={t("assetsEyebrow")} title={t("assets")}>
          {used.length ? (
            <ul className="grid grid-cols-2 gap-2.5">
              {used.map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-2.5">
                  <div aria-hidden className="grid h-16 place-items-center rounded-md bg-surface-muted text-sm font-black text-text-subtle">
                    {creativeIcon[c.type] ?? "✦"}
                  </div>
                  <strong className="mt-2 block truncate text-[10px] text-text-strong">{c.name}</strong>
                  <small className="block text-[9px] text-text-subtle">{tCreative(c.type)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-text-subtle">{t("noAssets")}</p>
          )}
        </Section>
      </Drawer>

      <ConfirmDialog
        open={confirm}
        title={t(status === "live" ? "pauseTitle" : "resumeTitle")}
        message={t(status === "live" ? "pauseMessage" : "resumeMessage", { name: campaign.name })}
        confirmLabel={status === "live" ? t("pause") : t("resume")}
        busy={busy}
        onConfirm={toggle}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function Section({ eyebrow, title, meta, children }: { eyebrow: string; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
          <h3 className="mt-1.5 text-[13px] font-semibold text-text">{title}</h3>
        </div>
        {meta && <span className="text-right text-[10px] text-text-subtle">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
