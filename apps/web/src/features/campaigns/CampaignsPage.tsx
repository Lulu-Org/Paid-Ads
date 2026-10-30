"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { useErrorMessage } from "@/lib/errors";
import { CampaignDrawer } from "./CampaignDrawer";
import { CampaignTable } from "./CampaignTable";
import { useCampaigns } from "./useCampaigns";

export function CampaignsPage() {
  const t = useTranslations("campaigns.summary");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const c = useCampaigns();

  if (c.error) {
    return (
      <>
        <PageHeader page="campaigns" />
        <Card>
          <EmptyState icon="!" title={errorMessage(c.error)} action={<Button variant="outline" onClick={c.reload}>{tCommon("retry")}</Button>} />
        </Card>
      </>
    );
  }

  const rows = c.rows ?? [];
  const live = rows.filter((r) => r.status === "live");
  // Planned spend: budgets of campaigns that are not over, in the most used currency.
  const planned = rows.filter((r) => r.status !== "ended");
  const currency = planned[0]?.budget.currency;
  const plannedSpend = planned.filter((r) => r.budget.currency === currency).reduce((sum, r) => sum + r.budget.amount, 0);
  const channels = new Set(planned.map((r) => r.platform)).size;
  const libraryCount = c.creatives.length;
  const needReview = c.creatives.filter((cr) => cr.approvalStatus === "pending").length;
  const drafts = rows.filter((r) => r.status === "draft").length;

  const cards = [
    { label: t("active"), value: format.number(live.length), note: t("activeNote") },
    { label: t("planned"), value: currency ? format.money({ amount: plannedSpend, currency }) : "—", note: t("plannedNote", { count: channels }) },
    { label: t("assets"), value: format.number(libraryCount), note: t("assetsNote", { count: needReview }) },
    { label: t("drafts"), value: format.number(drafts), note: t("draftsNote") },
  ];

  return (
    <>
      <PageHeader page="campaigns" />
      <div className="mb-4 grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[13px] border border-[#e8e7f0] bg-surface px-[18px] py-[17px] shadow-[0_8px_25px_#23234305]">
            <span className="block text-[9px] text-[#9293a2]">{card.label}</span>
            <strong className="mt-2 mb-[3px] block text-[22px] font-semibold tracking-[-0.04em] text-[#282943]">{c.rows ? card.value : "…"}</strong>
            <small className="block text-[9px] leading-[1.45] text-[#6d6e80]">{card.note}</small>
          </article>
        ))}
      </div>
      <CampaignTable rows={c.rows} loading={c.loading} filter={c.filter} onFilterChange={c.setFilter} onOpen={c.setOpen} />
      <CampaignDrawer campaign={c.open} creatives={c.creatives} onClose={() => c.setOpen(null)} onChanged={c.onChanged} />
    </>
  );
}
