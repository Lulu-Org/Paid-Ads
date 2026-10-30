"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CreativeListItem, CreativeType } from "@lulu/shared";
import { AdsCard, CardHeader, SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Drawer, EmptyState, Skeleton } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { AddCreativeModal } from "./AddCreativeModal";

// Preview gradients from the design (.creative-0 … .creative-4).
const gradients = [
  "from-[#dc8ac8] to-[#6355bd]",
  "from-[#7176e7] to-[#38c7d1]",
  "from-[#f6b069] to-[#d85b72]",
  "from-[#9ca2ba] to-[#555a7a]",
  "from-[#70d7b3] to-[#278887]",
];
const gradientFor = (type: CreativeType) =>
  ({ video: 0, search_ad: 1, carousel: 2, document: 3, extension: 4, lead_form: 0, image: 2, landing_page: 1, profile: 4 })[type];
const previewIcon: Partial<Record<CreativeType, string>> = { video: "▶", document: "PDF" };

// What the creative preview's badge says (design: LIVE, WINNER, REVIEW).
const badge = (c: CreativeListItem) => (c.approvalStatus === "pending" ? "review" : c.approvalStatus === "rejected" ? "rejected" : c.winning ? "winner" : "live");

export function CreativesPage() {
  const t = useTranslations("creatives");
  const tType = useTranslations("campaigns.creativeTypes");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const data = useApi(() => Promise.all([api.creatives.list(), api.creatives.tests()]), []);
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const creatives = data.data?.[0].data;
  const test = data.data?.[1][0];
  const open = creatives?.find((c) => c.id === openId) ?? null;
  const best = test ? Math.max(...test.variants.map((v) => (v.cpl ? 1 / v.cpl.amount : 0))) : 0;

  return (
    <>
      <PageHeader page="creatives" />
      <SectionHeading
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.description")}
        action={<Button icon="＋" onClick={() => setAddOpen(true)}>{t("add")}</Button>}
      />

      {data.error ? (
        <Card>
          <EmptyState icon="!" title={errorMessage(data.error)} action={<Button variant="outline" onClick={data.reload}>{tCommon("retry")}</Button>} />
        </Card>
      ) : (
        <>
          <section className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {!creatives
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[205px] rounded-[14px]" />)
              : creatives.map((c) => {
                  const kind = badge(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      aria-label={t("open", { name: c.name })}
                      className="overflow-hidden rounded-[14px] border border-[#e8e7f0] bg-surface text-left shadow-[0_8px_30px_#23234307] transition hover:-translate-y-0.5"
                    >
                      <div className={`relative grid h-[126px] place-items-center bg-gradient-to-br text-[22px] text-white ${gradients[gradientFor(c.type)]}`}>
                        <span aria-hidden>{previewIcon[c.type] ?? "✦"}</span>
                        <b className="absolute top-2.5 right-2.5 rounded-lg bg-[#17182d77] px-[7px] py-1 text-[7px] tracking-[0.1em] text-white uppercase">{t(`badge.${kind}`)}</b>
                      </div>
                      <div className="p-3">
                        <strong className="block text-[10px] font-semibold text-[#45465b]">{c.name}</strong>
                        <small className="mt-1 block text-[8px] text-[#999aa8]">
                          {tType(c.type)} · {t("campaigns", { count: c.campaignCount })}
                        </small>
                        <span className="mt-[11px] flex items-center gap-1 text-[8px] text-[#80818f]">
                          <i aria-hidden className={`size-[5px] rounded-full ${c.approvalStatus === "approved" ? "bg-[#42b98f]" : c.approvalStatus === "pending" ? "bg-[#e0a43a]" : "bg-[#c2413d]"}`} />
                          {t(`approval.${c.approvalStatus}`)}
                        </span>
                      </div>
                    </button>
                  );
                })}
          </section>

          {test && (
            <AdsCard className="mb-4 p-[21px]">
              <CardHeader
                eyebrow={t("testing.eyebrow")}
                title={
                  test.winnerLead !== null
                    ? t("testing.title", { variant: test.variants.find((v) => v.role === "winner")!.variant, lead: format.percent(test.winnerLead) })
                    : t("testing.noWinner")
                }
                description={t("testing.description", { campaign: test.campaignName })}
              />
              <div className="mt-6 grid gap-[18px] sm:grid-cols-3">
                {test.variants.map((v) => (
                  <div key={v.variant}>
                    <span className="block text-[9px] text-[#9899a6]">{t("testing.variant", { variant: v.variant, role: t(`testing.role.${v.role}`) })}</span>
                    <strong className="mt-1.5 block text-[16px] font-semibold text-[#3f4055]">
                      {v.cpl ? t("testing.cpl", { value: format.money(v.cpl, 2) }) : "—"}
                    </strong>
                    <i className="mt-2 mb-[5px] block h-[5px] overflow-hidden rounded-[5px] bg-[#efedf7]" aria-hidden>
                      <em className="block h-full rounded-[5px] bg-gradient-to-r from-[#6c5de3] to-[#67d5d6]" style={{ width: `${v.cpl && best ? (1 / v.cpl.amount / best) * 100 : 0}%` }} />
                    </i>
                    <small className="block text-[9px] text-[#9899a6]">
                      {t("testing.leads", { count: v.leads })} · {v.creativeName}
                    </small>
                  </div>
                ))}
              </div>
            </AdsCard>
          )}
        </>
      )}

      {open && (
        <Drawer open onClose={() => setOpenId(null)} eyebrow={t("detail.eyebrow", { type: tType(open.type) })} title={open.name}>
          <div className={`grid h-40 place-items-center rounded-xl bg-gradient-to-br text-3xl text-white ${gradients[gradientFor(open.type)]}`} aria-hidden>
            {previewIcon[open.type] ?? "✦"}
          </div>
          <dl className="mt-4">
            {(
              [
                [t("detail.status"), t(`approval.${open.approvalStatus}`)],
                [t("detail.usedIn"), t("campaigns", { count: open.campaignCount })],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3.5 border-b border-[#f0eff5] py-3">
                <dt className="text-[10px] text-text-subtle">{label}</dt>
                <dd className="text-right text-[10px] font-semibold text-text-strong">{value}</dd>
              </div>
            ))}
          </dl>
          {open.fileUrl && (
            <a href={open.fileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block text-[11px] font-semibold text-primary-hover hover:underline">
              {t("detail.openFile")} →
            </a>
          )}
        </Drawer>
      )}

      <AddCreativeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          data.reload();
        }}
      />
    </>
  );
}
