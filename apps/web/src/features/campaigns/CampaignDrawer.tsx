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
// Markers and labels from the design (.ads-plan-step).
const stepStyle = {
  done: "border-[#8dd8ba] bg-[#ecfaf4] text-[#2e9e79]",
  current: "border-[#8c80e7] bg-[#f1efff] text-[#6556da]",
  upcoming: "border-[#dad9e6] bg-surface text-[#9b9ca9]",
} as const;
// Dividers between the stat cells: 2 columns on phones, 3 from sm (design: .ads-detail-stats).
function statBorders(i: number) {
  return [
    "border-[#e8e7ef]",
    i % 2 === 0 ? "border-r" : "",
    i >= 2 ? "border-t pt-[15px]" : "",
    i % 3 === 2 ? "sm:border-r-0" : "sm:border-r",
    i >= 3 ? "sm:border-t sm:pt-[15px]" : "sm:border-t-0 sm:pt-[9px]",
  ].join(" ");
}

const stepLabel = { done: "text-[#2e9e79]", current: "text-[#6556da]", upcoming: "text-[#9b9ca9]" } as const;

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
      ? format.dateRange(campaign.startAt, campaign.endAt)
      : t("scheduleFrom", { start: format.date(campaign.startAt) })
    : t("scheduleNone");

  const stats: [string, string][] = [
    [t("impressions"), totals.impressions ? format.compact(totals.impressions) : dash],
    [t("clicks"), totals.clicks ? format.compact(totals.clicks) : dash],
    [t("ctr"), totals.ctr !== null ? format.percent2(totals.ctr) : dash],
    [t("conversions"), totals.conversions ? format.number(totals.conversions) : dash],
    [t("revenue"), totals.revenue.amount ? format.money(totals.revenue) : dash],
    [t("cpl"), totals.cpl ? format.money(totals.cpl, 2) : dash],
  ];

  const used = creatives.filter((c) => detail.data?.creativeIds.includes(c.id));

  return (
    <>
      <Drawer open wide onClose={onClose} eyebrow={t("eyebrow", { platform: tPlatform(`${campaign.platform}.name`) })} title={campaign.name}>
        <p className="-mt-4 border-b border-[#eeeef3] pb-5 text-[10px] text-[#8e8f9f]">{campaign.objective}</p>

        <div className="flex flex-wrap items-center gap-2 pt-[17px] pb-5">
          <span className="mr-auto">
            <Pill tone={statusTone[status]}>{tStatus(status)}</Pill>
          </span>
          {canToggle && (
            <Button variant="outline" onClick={() => setConfirm(true)} className="!px-[11px] !py-2 !text-[10px]">
              {status === "live" ? `Ⅱ ${t("pause")}` : `▶ ${t("resume")}`}
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[#ecebf3] bg-[#fbfbfd] p-3.5 sm:grid-cols-3">
          {stats.map(([label, value], i) => (
            <div key={label} className={`px-2.5 py-[9px] ${statBorders(i)}`}
            >
              <dt className="text-[9px] text-[#9293a3]">{label}</dt>
              <dd className="mt-[5px] text-[15px] font-semibold tracking-[-0.03em] text-[#2b2c45]">{value}</dd>
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
            <ol>
              {detail.data.plan.map((step, i, all) => (
                <li key={step.id} className="relative flex min-h-[53px] items-center gap-2.5 py-2 pl-[33px]">
                  <i
                    aria-hidden
                    className={`absolute left-2.5 w-px bg-[#e6e5ef] ${i === 0 ? "top-1/2" : "top-0"} ${i === all.length - 1 ? "bottom-1/2" : "bottom-0"}`}
                  />
                  <span aria-hidden className={`absolute left-px z-[1] grid size-[19px] place-items-center rounded-full border text-[10px] ${stepStyle[step.status]}`}>
                    {stepMark[step.status]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[10px] font-semibold text-[#3d3e55]">{step.label}</strong>
                    <small className="mt-[3px] block text-[9px] text-[#8e8f9f]">{step.detail}</small>
                  </span>
                  <b className={`text-[8px] font-semibold ${stepLabel[step.status]}`}>{t(`step.${step.status}`)}</b>
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
    <section className="border-b border-[#eeeef3] py-6 last:border-b-0">
      <div className="mb-3.5 flex items-end justify-between gap-[15px]">
        <div>
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
          <h3 className="mt-[7px] text-[14px] font-medium tracking-[-0.03em] text-[#2d2e47]">{title}</h3>
        </div>
        {meta && <span className="text-right text-[9px] text-[#9293a3]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
