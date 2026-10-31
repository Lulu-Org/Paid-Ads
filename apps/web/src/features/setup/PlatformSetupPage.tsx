"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CampaignDefaults } from "@lulu/shared";
import { Button, Card, Modal, SkeletonRows, useToast } from "@/components/ui";
import { PlatformMark, SectionHeading, adPlatformOrder, StatusText } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { adsHref } from "@/config/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

const defaultKeys = ["consentRequired", "autoTagLinks", "policyValidation"] as const satisfies readonly (keyof CampaignDefaults)[];

// Design: "Platform Setup". Each channel's account, tracking, permissions and policy status, and the
// guardrails every new campaign gets.
export function PlatformSetupPage() {
  const t = useTranslations("setup");
  const tPlatform = useTranslations("platforms");
  const format = useFormat();
  const accounts = useApi(() => api.adAccounts.list(), []);
  const health = useApi(() => api.tracking.health(), []);
  const defaults = useApi(() => api.campaignDefaults.get(), []);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageHeader page="setup" />
      <SectionHeading
        eyebrow={t("section.eyebrow")}
        title={t("section.title")}
        description={t("section.description")}
        action={
      <Link
        href={adsHref("integrations")}
        className="inline-flex items-center rounded-md border border-[#dad8ec] px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
      >
        {t("connectProvider")}
      </Link>
        }
      />
      {accounts.loading && !accounts.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2" aria-label={t("channelsLabel")}>
          {adPlatformOrder.map((platform) => {
            const account = accounts.data?.data.find((a) => a.platform === platform);
            const connected = account?.status === "connected";
            const rows: [string, React.ReactNode][] = [
              [t("account"), account?.name ?? "–"],
              [
                t("tracking"),
                connected ? (
                  <StatusText tone={health.data?.healthy === false ? "warning" : "success"}>
                    {t(health.data?.healthy === false ? "trackingReview" : "trackingHealthy")}
                  </StatusText>
                ) : (
                  "–"
                ),
              ],
              [t("permissions"), connected ? t("permissionList") : "–"],
              [t("policy"), connected ? t("noIssues") : "–"],
            ];
            return (
              <Card key={platform} className="min-w-0">
                <div className="flex items-center gap-3">
                  <PlatformMark platform={platform} />
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-text-strong">{tPlatform(`${platform}.name`)}</h3>
                    <small className={`block text-[10px] ${connected ? "text-[#299c76]" : "text-text-subtle"}`}>
                      {connected && account?.lastSyncAt
                        ? t("connectedAgo", { time: format.relative(account.lastSyncAt) })
                        : t("notConnected")}
                    </small>
                  </div>
                </div>
                <dl className="mt-4 rounded-[10px] border border-[#ecebf2] bg-[#fbfbfd] px-3.5 py-1.5">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-[#efeff3] py-2 text-[10px] last:border-b-0">
                      <dt className="text-[#9293a3]">{label}</dt>
                      <dd className="text-right font-semibold text-text-strong">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={adsHref("integrations")}
                  className="mt-3.5 inline-flex rounded-md border border-[#dad8ec] px-2.5 py-1.5 text-[10px] font-extrabold text-text-strong hover:bg-[#f7f5ff]"
                >
                  {t("configure")}
                </Link>
              </Card>
            );
          })}
        </section>
      )}

      <Card className="mt-5">
        <SectionHeading
          eyebrow={t("defaults.eyebrow")}
          title={t("defaults.title")}
          action={
            <Button variant="outline" onClick={() => setEditing(true)} disabled={!defaults.data}>
              {t("defaults.edit")}
            </Button>
          }
        />
        <dl className="grid gap-3 sm:grid-cols-3">
          {defaultKeys.map((key) => (
            <div key={key} className="rounded-lg border border-border p-3">
              <dt className="text-[10px] text-text-subtle">{t(`defaults.${key}`)}</dt>
              <dd className="mt-1 text-[12px] font-semibold text-text-strong">
                {defaults.data ? t(defaults.data[key] ? "on" : "off") : "–"}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {defaults.data && (
        <DefaultsModal
          open={editing}
          value={defaults.data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            defaults.reload();
          }}
        />
      )}
    </>
  );
}

function DefaultsModal({
  open,
  value,
  onClose,
  onSaved,
}: {
  open: boolean;
  value: CampaignDefaults;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("setup.defaults");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const save = async () => {
    setSaving(true);
    try {
      await api.campaignDefaults.update(draft);
      toast(t("saved"));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="mb-4 text-[11px] text-text-muted">{t("description")}</p>
      <div className="grid gap-2">
        {defaultKeys.map((key) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-[11px]">
            <span>
              <b className="block text-text-strong">{t(key)}</b>
              <small className="text-[10px] text-text-subtle">{t(`${key}Hint`)}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="size-4 accent-[#6259d6]"
              checked={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-[#efedf4] pt-4">
        <Button variant="outline" onClick={onClose}>
          {tCommon("cancel")}
        </Button>
        <Button loading={saving} onClick={save}>
          {tCommon("save")}
        </Button>
      </div>
    </Modal>
  );
}
