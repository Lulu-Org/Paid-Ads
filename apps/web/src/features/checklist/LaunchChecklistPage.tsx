"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ChecklistItemKey } from "@lulu/shared";
import { Button, Card, Pill, SkeletonRows, useToast } from "@/components/ui";
import { SectionHeading } from "@/components/ads";
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <SectionHeading
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            action={
              checklist.data && (
                <div className="text-right">
                  <strong className="block text-[22px] font-semibold text-text-strong">
                    {t("score", { passed: checklist.data.passed, total: checklist.data.total })}
                  </strong>
                  <small className="text-[10px] text-text-subtle">{t("completed")}</small>
                </div>
              )
            }
          />
          {checklist.loading && !checklist.data ? (
            <SkeletonRows rows={5} />
          ) : (
            <ul className="grid gap-2" aria-label={t("title")}>
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span
                    aria-hidden
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                      item.passed ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                    }`}
                  >
                    {item.passed ? "✓" : "!"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px] text-text-strong">{t(`items.${item.key}.label`)}</strong>
                    <small className="block text-[10px] text-text-subtle">{t(`items.${item.key}.hint`)}</small>
                  </span>
                  {item.passed ? (
                    <Pill tone="success">{t("complete")}</Pill>
                  ) : item.key === "approval_granted" ? (
                    <Button variant="outline" loading={requesting} onClick={requestApproval}>
                      {t("request")}
                    </Button>
                  ) : (
                    <Pill tone="warning">{t("open")}</Pill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 self-start">
          <SectionHeading eyebrow={t("decision.eyebrow")} title={t("decision.title")} />
          <dl className="grid gap-3 text-[11px]">
            <div>
              <dt className="font-extrabold text-success">{t("decision.ready")}</dt>
              <dd className="mt-0.5 text-text-muted">{passing.length ? names(passing) : "–"}</dd>
            </div>
            <div>
              <dt className="font-extrabold text-warning">{t("decision.needsReview")}</dt>
              <dd className="mt-0.5 text-text-muted">{failing.length ? names(failing) : t("decision.nothing")}</dd>
            </div>
            <div>
              <dt className="font-extrabold text-text-strong">{t("decision.next")}</dt>
              <dd className="mt-0.5 text-text-muted">
                {failing.length ? t(`items.${failing[0]!.key}.next`) : t("decision.readyToLaunch")}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#efedf4] pt-4">
            <Button variant="outline" onClick={share}>
              {t("decision.share")}
            </Button>
            <Button
              loading={requesting}
              disabled={!failing.some((i) => i.key === "approval_granted")}
              onClick={requestApproval}
            >
              {t("decision.requestApprovals")}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
