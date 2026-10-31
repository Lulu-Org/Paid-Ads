"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ChecklistItemKey } from "@lulu/shared";
import { Button, SkeletonRows, useToast } from "@/components/ui";
import { AdsCard, StatusText } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

// Design: "Launch Checklist". Nothing launches until data, assets, permissions and approvals are ready;
// the checks come from the shared launchChecklist rules.
export function LaunchChecklistPage() {
  const t = useTranslations("checklist");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const campaigns = useApi(() => api.campaigns.list({ pageSize: 100 }), []);
  const [campaignId, setCampaignId] = useState<string>("");
  const checklist = useApi(
    () => (campaignId ? api.campaigns.checklist(campaignId) : Promise.resolve(null)),
    [campaignId],
  );
  const [requesting, setRequesting] = useState(false);

  // Start on the first draft: that is the campaign waiting to launch.
  useEffect(() => {
    const rows = campaigns.data?.data;
    if (!campaignId && rows?.length) setCampaignId((rows.find((c) => c.status === "draft") ?? rows[0]!).id);
  }, [campaigns.data, campaignId]);

  const items = checklist.data?.items ?? [];
  const failing = items.filter((i) => !i.passed);
  const passing = items.filter((i) => i.passed);
  const names = (keys: { key: ChecklistItemKey }[]) => keys.map((i) => t(`items.${i.key}.label`)).join(", ");

  const requestApproval = async () => {
    setRequesting(true);
    try {
      await api.approvals.request({ kind: "launch", campaignId, payload: {} });
      toast(t("approvalRequested"));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setRequesting(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(t("shared"));
    } catch {
      toast(t("shareFailed"), "error");
    }
  };

  return (
    <>
      <PageHeader
        page="checklist"
        actions={
          <label className="flex items-center gap-2 text-[11px] text-text-muted">
            {t("campaign")}
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[11px] text-text"
            >
              {campaigns.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <AdsCard className="mb-4 p-[21px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-[7px] text-[16px] font-medium tracking-[-0.03em] text-[#292a43]">{t("title")}</h2>
            <p className="mt-1 text-[12px] text-[#8b8c9c]">{t("description")}</p>
          </div>
          {checklist.data && (
            <div className="rounded-xl bg-[#f1efff] px-4 py-2.5 text-center">
              <strong className="block text-[20px] font-semibold text-[#5e53bd]">
                {t("score", { passed: checklist.data.passed, total: checklist.data.total })}
              </strong>
              <small className="text-[9px] text-[#8178c0]">{t("completed")}</small>
            </div>
          )}
        </div>
      </AdsCard>

      <AdsCard className="mb-4 px-[21px] py-2">
        {checklist.loading && !checklist.data ? (
          <div className="py-4">
            <SkeletonRows rows={5} />
          </div>
        ) : (
          <ul aria-label={t("title")}>
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3 border-b border-[#efeff3] py-3.5 last:border-b-0">
                <span
                  aria-hidden
                  className={`grid size-[22px] shrink-0 place-items-center rounded-full border text-[10px] ${
                    item.passed ? "border-[#9bdfc4] bg-[#e8faf2] text-[#299c76]" : "border-[#f3d39c] bg-[#fff6e6] text-[#b47a2a]"
                  }`}
                >
                  {item.passed ? "✓" : "!"}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[10px] font-semibold text-[#3d3e55]">{t(`items.${item.key}.label`)}</strong>
                  <small className="mt-0.5 block text-[9px] text-[#8e8f9f]">{t(`items.${item.key}.hint`)}</small>
                </span>
                {item.passed ? (
                  <StatusText tone="success">{t("complete")}</StatusText>
                ) : item.key === "approval_granted" ? (
                  <button type="button" disabled={requesting} onClick={requestApproval} className="text-[10px] font-extrabold text-primary-hover hover:underline disabled:opacity-50">
                    {t("request")}
                  </button>
                ) : (
                  <StatusText tone="warning">{t("open")}</StatusText>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdsCard>

      <AdsCard className="mb-4 p-[21px]">
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("decision.eyebrow")}</span>
        <h2 className="mt-[7px] mb-4 text-[16px] font-medium tracking-[-0.03em] text-[#292a43]">{t("decision.title")}</h2>
        <dl className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["ready", t("decision.ready"), passing.length ? names(passing) : "–"],
              ["needsReview", t("decision.needsReview"), failing.length ? names(failing) : t("decision.nothing")],
              ["next", t("decision.next"), failing.length ? t(`items.${failing[0]!.key}.next`) : t("decision.readyToLaunch")],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="rounded-[10px] border border-[#ecebf2] bg-[#fcfcfe] p-3.5">
              <dt className="text-[9px] font-bold tracking-[0.08em] text-[#5b51d2] uppercase">{label}</dt>
              <dd className="mt-[7px] text-[10px] leading-[1.6] text-[#77788a]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={share}>
            {t("decision.share")}
          </Button>
          <Button loading={requesting} disabled={!failing.some((i) => i.key === "approval_granted")} onClick={requestApproval}>
            {t("decision.requestApprovals")}
          </Button>
        </div>
      </AdsCard>
    </>
  );
}
