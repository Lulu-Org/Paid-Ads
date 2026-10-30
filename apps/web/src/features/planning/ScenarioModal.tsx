"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buildPlanning, type Planning } from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

const input =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

/**
 * Save scenario: change the amount per channel and see the allocation and forecast update as you type.
 * The forecast uses the same rule as the server (buildPlanning), scaled from the plan's own numbers.
 */
export function ScenarioModal({
  open,
  planning,
  onClose,
  onSaved,
}: {
  open: boolean;
  planning: Planning;
  onClose: () => void;
  onSaved: (planning: Planning) => void;
}) {
  const t = useTranslations("planning.scenario");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const currency = planning.limit.currency;

  useEffect(() => {
    if (!open) return;
    setName(t("defaultName", { month: format.monthYear(`${planning.plan.month}-01T00:00:00Z`) }));
    setAmounts(Object.fromEntries(planning.plan.channels.map((c) => [c.platform, String(c.planned.amount)])));
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parse = (value: string | undefined) => {
    const n = Number((value ?? "").replace(",", "."));
    return value !== undefined && value.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const invalid = planning.plan.channels.filter((c) => parse(amounts[c.platform]) === null).map((c) => c.platform);

  // Per-channel history recovered from the current forecast (revenue ÷ planned = ROAS, planned ÷ leads = CPL).
  const preview = useMemo(() => {
    if (invalid.length) return null;
    const history = Object.fromEntries(
      planning.plan.channels.flatMap((c) => {
        const row = planning.channels.find((r) => r.platform === c.platform);
        if (!row?.forecastLeads || !row.forecastRevenue) return [];
        return [[c.platform, { spend: c.planned.amount, leads: row.forecastLeads, revenue: row.forecastRevenue.amount }]];
      }),
    );
    const plan = { ...planning.plan, channels: planning.plan.channels.map((c) => ({ ...c, planned: { amount: parse(amounts[c.platform])!, currency } })) };
    return buildPlanning(plan, planning.limit, history, planning.previousTargetLeads);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts, planning]);

  const overLimit = preview ? preview.allocated.amount > planning.limit.amount : false;

  const save = async () => {
    setSubmitted(true);
    if (!name.trim() || invalid.length) return;
    setSaving(true);
    try {
      const result = await api.planning.saveScenario({
        name: name.trim(),
        channels: planning.plan.channels.map((c) => ({ platform: c.platform, planned: { amount: parse(amounts[c.platform])!, currency } })),
      });
      toast(t("saved", { name: name.trim() }));
      onSaved(result);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="-mt-2 mb-4 text-[11px] leading-relaxed text-text-muted">{t("description")}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-3.5"
      >
        <div className="grid gap-1.5">
          <label htmlFor="scenario-name" className="text-[10px] font-extrabold text-neutral">{t("name")}</label>
          <input id="scenario-name" className={input} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !name.trim() ? true : undefined} />
          {submitted && !name.trim() && <span className="text-[10px] text-[#c2413d]">{t("errors.nameRequired")}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {planning.plan.channels.map((c) => (
            <div key={c.platform} className="grid gap-1.5">
              <label htmlFor={`scenario-${c.platform}`} className="text-[10px] font-extrabold text-neutral">
                {t("amount", { platform: tPlatform(`${c.platform}.name`), currency })}
              </label>
              <input
                id={`scenario-${c.platform}`}
                className={input}
                inputMode="decimal"
                value={amounts[c.platform] ?? ""}
                onChange={(e) => setAmounts({ ...amounts, [c.platform]: e.target.value })}
                aria-invalid={submitted && invalid.includes(c.platform) ? true : undefined}
              />
            </div>
          ))}
        </div>
        {submitted && invalid.length > 0 && <span className="text-[10px] text-[#c2413d]">{t("errors.amountInvalid")}</span>}

        {preview && (
          <dl className="grid grid-cols-3 gap-2 rounded-xl border border-[#ecebf3] bg-[#fbfbfd] p-3 text-center" aria-live="polite">
            <div>
              <dt className="text-[9px] text-[#9293a3]">{t("allocated")}</dt>
              <dd className={`mt-1 text-[13px] font-semibold ${overLimit ? "text-[#c2413d]" : "text-[#2b2c45]"}`} data-testid="scenario-allocated">
                {format.money(preview.allocated)}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] text-[#9293a3]">{t("targetLeads")}</dt>
              <dd className="mt-1 text-[13px] font-semibold text-[#2b2c45]">{format.number(preview.targetLeads)}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-[#9293a3]">{t("forecastRevenue")}</dt>
              <dd className="mt-1 text-[13px] font-semibold text-[#2b2c45]">{format.compactMoney(preview.forecastRevenue)}</dd>
            </div>
          </dl>
        )}
        {overLimit && <p className="text-[10px] text-[#c2413d]">{t("overLimit", { limit: format.money(planning.limit) })}</p>}

        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
          <Button type="submit" loading={saving}>{t("submit")}</Button>
        </div>
      </form>
    </Modal>
  );
}
