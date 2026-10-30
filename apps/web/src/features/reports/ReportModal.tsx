"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import type { AdPlatform } from "@lulu/shared";
import { adPlatformOrder } from "@/components/ads";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

// Schedules as cron in UTC (Report.schedule): Mondays or the 1st of the month, at 08:00.
export const schedules = { weekly: "0 8 * * 1", monthly: "0 8 1 * *" } as const;
const rangeOptions = [7, 30, 90] as const;
const compareOptions = ["previous_period", "previous_year", "none"] as const;

const input =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

const emailList = z.array(z.email());

/**
 * "Schedule report" saves the current view with a schedule and recipients.
 * "Custom report" builds a view (channels, range, comparison) and saves it to run on demand.
 */
export function ReportModal({
  kind,
  view,
  onClose,
  onSaved,
}: {
  kind: "schedule" | "custom";
  view: { platforms: AdPlatform[]; rangeDays: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("reports.form");
  const tReports = useTranslations("reports");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<keyof typeof schedules>("weekly");
  const [recipients, setRecipients] = useState("");
  const [platforms, setPlatforms] = useState<AdPlatform[]>(view.platforms);
  const [rangeDays, setRangeDays] = useState<number>(rangeOptions.includes(view.rangeDays as 30) ? view.rangeDays : 30);
  const [compare, setCompare] = useState<(typeof compareOptions)[number]>("previous_period");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const emails = recipients.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);
  const emailsValid = emailList.safeParse(emails).success;
  const errors = {
    name: !name.trim() ? t("errors.nameRequired") : null,
    recipients: kind !== "schedule" ? null : emails.length === 0 ? t("errors.recipientsRequired") : !emailsValid ? t("errors.recipientsInvalid") : null,
  };

  const save = async () => {
    setSubmitted(true);
    if (errors.name || errors.recipients) return;
    setSaving(true);
    try {
      await api.reports.create({
        name: name.trim(),
        view: kind === "schedule" ? { platforms: view.platforms, rangeDays: view.rangeDays, compare: "previous_period" } : { platforms, rangeDays, compare },
        schedule: kind === "schedule" ? schedules[frequency] : null,
        recipients: kind === "schedule" ? emails : [],
      });
      toast(t(kind === "schedule" ? "scheduled" : "saved", { name: name.trim() }));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, control: React.ReactNode, error?: string | null) => (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-[10px] font-extrabold text-neutral">{label}</label>
      {control}
      {submitted && error && <span className="text-[10px] text-[#c2413d]">{error}</span>}
    </div>
  );

  return (
    <Modal open onClose={onClose} eyebrow={t(`${kind}.eyebrow`)} title={t(`${kind}.title`)}>
      <p className="-mt-2 mb-4 text-[11px] leading-relaxed text-text-muted">{t(`${kind}.description`)}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-3.5"
      >
        {field(
          "report-name",
          t("name"),
          <input id="report-name" className={input} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && errors.name ? true : undefined} />,
          errors.name,
        )}

        {kind === "schedule" ? (
          <>
            {field(
              "report-frequency",
              t("frequency"),
              <select id="report-frequency" className={input} value={frequency} onChange={(e) => setFrequency(e.target.value as keyof typeof schedules)}>
                {Object.keys(schedules).map((key) => (
                  <option key={key} value={key}>{tReports(`schedule.${key}`)}</option>
                ))}
              </select>,
            )}
            {field(
              "report-recipients",
              t("recipients"),
              <input id="report-recipients" className={input} placeholder={t("recipientsPlaceholder")} value={recipients} onChange={(e) => setRecipients(e.target.value)} aria-invalid={submitted && errors.recipients ? true : undefined} />,
              errors.recipients,
            )}
            <p className="text-[10px] text-text-subtle">
              {t("currentView", {
                channels: view.platforms.length ? view.platforms.map((p) => tPlatform(`${p}.name`)).join(", ") : tReports("allChannels"),
                days: view.rangeDays,
              })}
            </p>
          </>
        ) : (
          <>
            <fieldset>
              <legend className="mb-1.5 text-[10px] font-extrabold text-neutral">{t("channels")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {adPlatformOrder.map((p) => (
                  <label key={p} className="flex items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-[11px] text-text-strong">
                    <input type="checkbox" className="accent-[#6259d6]" checked={platforms.includes(p)} onChange={() => setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p])} />
                    {tPlatform(`${p}.name`)}
                  </label>
                ))}
              </div>
              <small className="mt-1 block text-[10px] text-text-subtle">{t("channelsHint")}</small>
            </fieldset>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field(
                "report-range",
                t("range"),
                <select id="report-range" className={input} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
                  {rangeOptions.map((days) => (
                    <option key={days} value={days}>{tReports("lastDays", { count: days })}</option>
                  ))}
                </select>,
              )}
              {field(
                "report-compare",
                t("compare"),
                <select id="report-compare" className={input} value={compare} onChange={(e) => setCompare(e.target.value as (typeof compareOptions)[number])}>
                  {compareOptions.map((c) => (
                    <option key={c} value={c}>{t(`compareOptions.${c}`)}</option>
                  ))}
                </select>,
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
          <Button type="submit" loading={saving}>{t(`${kind}.submit`)}</Button>
        </div>
      </form>
    </Modal>
  );
}
