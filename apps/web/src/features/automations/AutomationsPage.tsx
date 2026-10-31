"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AutomationRule } from "@lulu/shared";
import { Button, Card, Pill, SkeletonRows, useToast } from "@/components/ui";
import { SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { RuleModal } from "./RuleModal";

const actionIcons: Record<AutomationRule["action"], string> = {
  notify: "↗",
  recommend: "↗",
  pause_campaign: "!",
  shift_budget: "€",
  send_digest: "◷",
};

// Design: "Automations". Rules that notify, recommend or pause campaigns, and what they did recently.
export function AutomationsPage() {
  const t = useTranslations("automations");
  const tRule = useTranslations("automations.rule");
  const tPlatform = useTranslations("platforms");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const rules = useApi(() => api.automations.list(), []);
  const activity = useApi(() => api.automations.activity(), []);
  const campaigns = useApi(() => api.campaigns.list({ pageSize: 100 }), []);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);

  const ruleName = (id: string) => rules.data?.data.find((r) => r.id === id)?.name ?? "–";
  const campaignName = (id: string | null) =>
    id ? (campaigns.data?.data.find((c) => c.id === id)?.name ?? "–") : t("activity.allChannels");

  const describe = (rule: AutomationRule) => {
    if (!rule.condition) return tRule("digest");
    const { metric, operator, value, window } = rule.condition;
    const shown = metric === "cpl" || metric === "spend" ? format.money({ amount: value, currency: "EUR" }) : format.number(value);
    return tRule("when", {
      metric: tRule(`metrics.${metric}`),
      operator: tRule(`operators.${operator}`),
      value: shown,
      window: tRule(`window.${window.unit}`, { count: window.amount }),
      action: tRule(`actions.${rule.action}`),
    });
  };

  const scope = (rule: AutomationRule) =>
    rule.trigger.platforms.length === 0
      ? tRule("allChannels")
      : rule.trigger.platforms.map((p) => tPlatform(`${p}.name`)).join(" · ");

  const toggle = async (rule: AutomationRule) => {
    try {
      await api.automations.update(rule.id, { enabled: !rule.enabled });
      toast(t(rule.enabled ? "paused" : "resumed", { name: rule.name }));
      rules.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <>
      <PageHeader page="automations" />
      <SectionHeading
        eyebrow={t("section.eyebrow")}
        title={t("section.title")}
        description={t("section.description")}
        action={
      <Button icon="＋" onClick={() => setCreating(true)}>
        {t("create")}
      </Button>
        }
      />
      {rules.loading && !rules.data ? (
        <SkeletonRows rows={3} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("rulesLabel")}>
          {rules.data?.data.map((rule) => (
            <article key={rule.id} className="flex flex-col rounded-[13px] border border-[#e8e7f0] bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-black text-[#5e53bd]">
                  {actionIcons[rule.action]}
                </span>
                <Pill tone={rule.enabled ? "success" : "neutral"}>{t(rule.enabled ? "on" : "off")}</Pill>
              </div>
              <h3 className="mt-3 text-[13px] font-semibold text-text-strong">{rule.name}</h3>
              <p className="mt-1 flex-1 text-[11px] leading-relaxed text-text-muted">{describe(rule)}</p>
              <footer className="mt-4 flex items-center justify-between gap-2 border-t border-surface-muted pt-3">
                <small className="truncate text-[10px] text-text-subtle">{scope(rule)}</small>
                <span className="flex gap-1">
                  {rule.condition && (
                    <Button variant="ghost" onClick={() => setEditing(rule)} aria-label={t("editRule", { name: rule.name })}>
                      {t("edit")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => toggle(rule)}>
                    {t(rule.enabled ? "pause" : "resume")}
                  </Button>
                </span>
              </footer>
            </article>
          ))}
        </section>
      )}

      <Card className="mt-5">
        <SectionHeading eyebrow={t("activity.eyebrow")} title={t("activity.title")} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-[11px]">
            <thead className="text-[8px] font-bold tracking-[0.08em] text-[#a0a1ad]">
              <tr>
                <th className="py-2 font-black">{t("activity.rule")}</th>
                <th className="py-2 font-black">{t("activity.action")}</th>
                <th className="py-2 font-black">{t("activity.campaign")}</th>
                <th className="py-2 font-black">{t("activity.time")}</th>
              </tr>
            </thead>
            <tbody>
              {activity.data?.data.map((row) => (
                <tr key={row.id} className="border-t border-surface-muted">
                  <td className="py-3 font-semibold text-text-strong">{ruleName(row.ruleId)}</td>
                  <td className="py-3 text-text-muted">{t(`activity.outcomes.${row.outcome}`)}</td>
                  <td className="py-3 text-text-muted">{campaignName(row.campaignId)}</td>
                  <td className="py-3 text-text-muted">{format.relative(row.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.data?.data.length === 0 && <p className="py-3 text-[11px] text-text-subtle">{t("activity.empty")}</p>}
        </div>
      </Card>

      <RuleModal
        open={creating || editing !== null}
        rule={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          rules.reload();
        }}
      />
    </>
  );
}
