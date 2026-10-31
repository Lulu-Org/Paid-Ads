"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AudienceListItem, AudienceSource } from "@lulu/shared";
import { AdsCard, CardHeader, PlatformMark, SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Drawer, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { CreateAudienceModal } from "./CreateAudienceModal";

// Icon and colours per source (design: .audience-icon violet / blue / mint).
const sourceIcon: Record<AudienceSource, { icon: string; className: string }> = {
  website_visitors: { icon: "♙", className: "bg-[#eeecff] text-[#6254d8]" },
  crm_segment: { icon: "♧", className: "bg-[#e8f3fc] text-[#3e88d4]" },
  lookalike: { icon: "✦", className: "bg-[#e5f8f1] text-[#258f7a]" },
  customer_list: { icon: "☷", className: "bg-[#fff2d8] text-[#a5792d]" },
};

// Refreshing now, or never synced yet: the card offers "Refresh now" instead of "View audience".
const needsSync = (a: AudienceListItem) => a.syncing || a.lastSyncedAt === null;

export function AudiencesPage() {
  const t = useTranslations("audiences");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useApi(() => api.audiences.list(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const rows = list.data?.data;
  const open = rows?.find((a) => a.id === openId) ?? null;

  const refresh = async (audience: AudienceListItem) => {
    setRefreshing(audience.id);
    try {
      await api.audiences.sync(audience.id);
      toast(t("refreshed", { name: audience.name }));
      list.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setRefreshing(null);
    }
  };

  const size = (a: AudienceListItem) => (a.sizeEstimate === null ? "—" : a.sizeEstimate >= 100_000 ? format.compact(a.sizeEstimate) : format.number(a.sizeEstimate));
  const lastSync = (a: AudienceListItem) => (a.lastSyncedAt ? format.recent(a.lastSyncedAt) : t("never"));

  return (
    <>
      <PageHeader page="audiences" />
      <SectionHeading
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.description")}
        action={<Button icon="＋" onClick={() => setCreateOpen(true)}>{t("create")}</Button>}
      />

      {list.error ? (
        <Card>
          <EmptyState icon="!" title={errorMessage(list.error)} action={<Button variant="outline" onClick={list.reload}>{tCommon("retry")}</Button>} />
        </Card>
      ) : (
        <>
          <section className="mb-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {!rows
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[260px] rounded-[14px]" />)
              : rows.length === 0
                ? <AdsCard className="p-5 md:col-span-2 xl:col-span-3"><EmptyState title={t("empty")} /></AdsCard>
                : rows.map((a) => (
                    <AdsCard key={a.id} className="p-[18px]">
                      <div className="flex items-center justify-between">
                        <span aria-hidden className={`grid size-[31px] place-items-center rounded-[10px] text-[13px] ${sourceIcon[a.source].className}`}>
                          {sourceIcon[a.source].icon}
                        </span>
                        <b className={`rounded-[20px] px-2 py-1 text-[8px] ${needsSync(a) ? "bg-[#fff2d8] text-[#a5792d]" : "bg-[#e7f7ee] text-[#2d986f]"}`}>
                          {a.syncing ? t("syncing") : a.lastSyncedAt === null ? t("notSynced") : t("synced")}
                        </b>
                      </div>
                      <h3 className="mt-[15px] mb-1 text-[12px] font-medium text-[#35364d]">{a.name}</h3>
                      <p className="text-[9px] text-[#9a9ba8]">{a.description ?? t(`sources.${a.source}`)}</p>
                      <strong className="mt-4 mb-3 block text-[23px] font-semibold tracking-[-0.04em] text-[#2c2d46]">
                        {size(a)} <small className="text-[9px] font-medium text-[#9495a2]">{a.source === "lookalike" ? t("estimatedReach") : t("people")}</small>
                      </strong>
                      <div className="flex gap-[18px] border-y border-[#efeff3] py-[11px]">
                        <span className="text-[8px] text-[#999aa8]">
                          {a.matchRate === null ? t("source") : t("matchRate")}
                          <b className="mt-[3px] block text-[9px] text-[#53546a]">{a.matchRate === null ? t(`sourceShort.${a.source}`) : format.percent(a.matchRate)}</b>
                        </span>
                        <span className="text-[8px] text-[#999aa8]">
                          {t("usedIn")}
                          <b className="mt-[3px] block text-[9px] text-[#53546a]">{t("campaigns", { count: a.campaignCount })}</b>
                        </span>
                      </div>
                      {needsSync(a) ? (
                        <Button variant="outline" className="mt-3.5 !px-2.5 !py-2 !text-[9px]" loading={refreshing === a.id} onClick={() => refresh(a)}>
                          {t("refresh")}
                        </Button>
                      ) : (
                        <Button variant="outline" className="mt-3.5 !px-2.5 !py-2 !text-[9px]" onClick={() => setOpenId(a.id)}>
                          {t("view")}
                        </Button>
                      )}
                    </AdsCard>
                  ))}
          </section>

          <AdsCard className="mb-4 p-[21px]">
            <CardHeader
              eyebrow={t("controls.eyebrow")}
              title={t("controls.title")}
              action={<Link href="/ads/platform-setup" className="text-[11px] font-semibold text-primary-hover hover:underline">{t("controls.privacy")} →</Link>}
            />
            <div className="relative mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left text-[9px] text-[#626377]">
                <thead>
                  <tr className="text-[8px] font-bold tracking-[0.08em] text-[#a0a1ad]">
                    <th className="pb-[11px] font-bold">{t("controls.source")}</th>
                    <th className="pb-[11px] font-bold">{t("controls.lastSync")}</th>
                    <th className="pb-[11px] font-bold">{t("controls.consent")}</th>
                    <th className="pb-[11px] font-bold">{t("controls.exclusions")}</th>
                    <th className="pb-[11px]"><span className="sr-only">{t("controls.actions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((a) => (
                    <tr key={a.id} className="border-t border-[#efeff3]">
                      <td className="py-[11px]">{a.name}</td>
                      <td className="py-[11px]">{lastSync(a)}</td>
                      <td className="py-[11px] text-[#299c76]" title={a.consentBasis}>✓ {t("controls.valid")}</td>
                      <td className="py-[11px]">{a.exclusions.length ? a.exclusions.join(", ") : "—"}</td>
                      <td className="py-[11px] text-right">
                        <button type="button" onClick={() => setOpenId(a.id)} aria-label={t("open", { name: a.name })} className="rounded px-1.5 tracking-widest text-text-subtle hover:bg-surface-muted">
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdsCard>
        </>
      )}

      {open && (
        <Drawer open onClose={() => setOpenId(null)} eyebrow={t("detail.eyebrow")} title={open.name}>
          <dl className="grid gap-0">
            {(
              [
                [t("detail.source"), t(`sources.${open.source}`)],
                [t("detail.size"), `${size(open)} ${open.source === "lookalike" ? t("estimatedReach") : t("people")}`],
                [t("matchRate"), open.matchRate === null ? "—" : format.percent(open.matchRate)],
                [t("detail.consent"), open.consentBasis],
                [t("controls.exclusions"), open.exclusions.length ? open.exclusions.join(", ") : "—"],
                [t("controls.lastSync"), lastSync(open)],
                [t("usedIn"), t("campaigns", { count: open.campaignCount })],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3.5 border-b border-[#f0eff5] py-3">
                <dt className="text-[10px] text-text-subtle">{label}</dt>
                <dd className="max-w-[65%] text-right text-[10px] font-semibold text-text-strong">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 mb-3 text-[12px] font-medium text-text-strong">{t("detail.platforms")}</h3>
          <ul className="flex flex-wrap gap-2">
            {open.platforms.map((p) => (
              <li key={p}>
                <PlatformMark platform={p} />
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6" loading={refreshing === open.id} onClick={() => refresh(open)}>
            {t("refresh")}
          </Button>
        </Drawer>
      )}

      <CreateAudienceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          list.reload();
        }}
      />
    </>
  );
}
