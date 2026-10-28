"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdAccount, AdPlatform } from "@lulu/shared";
import { Button, Card, Pill, SkeletonRows, useToast } from "@/components/ui";
import { PlatformMark, SectionHeading, adPlatformOrder } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormat } from "@/i18n/format";
import { api, useMock } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

// Design: "Integrations". One card per ad platform with its connection, and the sync history.
export function IntegrationsPage() {
  const t = useTranslations("integrations");
  const tPlatform = useTranslations("platforms");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const accounts = useApi(() => api.adAccounts.list(), []);
  const runs = useApi(() => api.operations.syncRuns(), []);
  const [busy, setBusy] = useState<AdPlatform | null>(null);

  const accountFor = (platform: AdPlatform) => accounts.data?.data.find((a) => a.platform === platform);
  const connected = (account: AdAccount | undefined) => account?.status === "connected";

  const connect = async (platform: AdPlatform) => {
    setBusy(platform);
    try {
      const { authorizeUrl } = await api.adAccounts.connect(platform);
      // The real API answers with the platform's sign-in page; the mock connects at once.
      if (!useMock) {
        window.location.assign(authorizeUrl);
        return;
      }
      toast(t("connected", { platform: tPlatform(`${platform}.name`) }));
      accounts.reload();
      runs.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };

  const sync = async (account: AdAccount) => {
    setBusy(account.platform);
    try {
      await api.adAccounts.sync(account.id);
      toast(t("syncQueued", { platform: tPlatform(`${account.platform}.name`) }));
      accounts.reload();
      runs.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader page="integrations" />
      {accounts.loading && !accounts.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2" aria-label={t("platformsLabel")}>
          {adPlatformOrder.map((platform) => {
            const account = accountFor(platform);
            const isConnected = connected(account);
            return (
              <article key={platform} className="flex flex-col rounded-[13px] border border-[#e8e7f0] bg-surface p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <PlatformMark platform={platform} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-semibold text-text-strong">{tPlatform(`${platform}.name`)}</h3>
                    <small className="block text-[10px] text-text-subtle">{tPlatform(`${platform}.detail`)}</small>
                  </div>
                  <Pill tone={isConnected ? "success" : "neutral"}>{t(isConnected ? "statusConnected" : "statusNotConnected")}</Pill>
                </div>
                <ul className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                  {(["campaigns", "assets", "performance"] as const).map((scope) => (
                    <li key={scope} className="rounded-md bg-surface-muted px-2 py-1">
                      {t(`scopes.${scope}`)}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex-1 text-[10px] text-text-subtle">
                  {isConnected && account?.lastSyncAt
                    ? t("lastSync", { time: format.relative(account.lastSyncAt) })
                    : t("needsAuthorization")}
                </p>
                <div className="mt-4 flex justify-end">
                  {isConnected && account ? (
                    <Button variant="outline" loading={busy === platform} onClick={() => sync(account)}>
                      {t("syncNow")}
                    </Button>
                  ) : (
                    <Button loading={busy === platform} onClick={() => connect(platform)}>
                      {t("connect")}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Card className="mt-5">
        <SectionHeading eyebrow={t("history.eyebrow")} title={t("history.title")} />
        <ul className="grid gap-2">
          {runs.data?.data.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-3 border-t border-surface-muted py-2.5 text-[11px] first:border-t-0">
              <Pill tone={run.status === "succeeded" ? "success" : run.status === "failed" ? "warning" : "info"}>
                {t(`history.status.${run.status}`)}
              </Pill>
              <b className="text-text-strong">{tPlatform(`${run.platform}.name`)}</b>
              <span className="flex-1 text-text-muted">{t(`history.kind.${run.kind}`)}</span>
              <time dateTime={run.finishedAt ?? run.startedAt} className="text-text-subtle">
                {format.relative(run.finishedAt ?? run.startedAt)}
              </time>
            </li>
          ))}
        </ul>
        {runs.data?.data.length === 0 && <p className="text-[11px] text-text-subtle">{t("history.empty")}</p>}
      </Card>
    </>
  );
}
