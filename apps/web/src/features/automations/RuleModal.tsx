"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  automationActionSchema,
  automationMetricSchema,
  automationRuleCreateSchema,
  type AdPlatform,
  type AutomationAction,
  type AutomationMetric,
  type AutomationRule,
} from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { adPlatformOrder } from "@/components/ads";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";

// Digests run on a schedule and have no condition, so they are not built here.
const conditionActions = automationActionSchema.options.filter((a) => a !== "send_digest");

/**
 * Create or edit a rule that watches a metric (design: "New automation"): trigger platforms, condition and a
 * safe action. Budget actions only ask for approval; they never change spend on their own.
 */
export function RuleModal({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: AutomationRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("automations.form");
  const tRule = useTranslations("automations.rule");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<AutomationMetric>("cpl");
  const [operator, setOperator] = useState<"above" | "below">("above");
  const [value, setValue] = useState("");
  const [amount, setAmount] = useState("3");
  const [unit, setUnit] = useState<"hours" | "days">("days");
  const [action, setAction] = useState<AutomationAction>("notify");
  const [platforms, setPlatforms] = useState<AdPlatform[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fill the form each time it opens.
  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? "");
    setMetric(rule?.condition?.metric ?? "cpl");
    setOperator(rule?.condition?.operator ?? "above");
    setValue(rule?.condition ? String(rule.condition.value) : "");
    setAmount(String(rule?.condition?.window.amount ?? 3));
    setUnit(rule?.condition?.window.unit ?? "days");
    setAction(rule?.action ?? "notify");
    setPlatforms(rule?.trigger.platforms ?? []);
    setInvalid(false);
  }, [open, rule]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = automationRuleCreateSchema.safeParse({
      name,
      trigger: { platforms, schedule: null },
      condition: {
        metric,
        operator,
        value: Number(value.replace(",", ".")),
        window: { amount: Number(amount), unit },
      },
      action,
      enabled: rule?.enabled ?? true,
    });
    if (!parsed.success || value.trim() === "") {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      if (rule) await api.automations.update(rule.id, parsed.data);
      else await api.automations.create(parsed.data);
      toast(t(rule ? "updated" : "created"));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const select = <T extends string>(label: string, current: T, set: (v: T) => void, options: readonly T[], text: (v: T) => string) => (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-extrabold text-neutral">{label}</span>
      <select className={inputClass} value={current} onChange={(e) => set(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {text(o)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} eyebrow={t(rule ? "editEyebrow" : "eyebrow")} title={t("title")} wide>
      <p className="mb-4 text-[11px] text-text-muted">{t("description")}</p>
      <form onSubmit={save} noValidate className="grid gap-3.5 sm:grid-cols-2">
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-[10px] font-extrabold text-neutral">{t("name")}</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
        </label>
        {select(t("metric"), metric, setMetric, automationMetricSchema.options, (m) => tRule(`metrics.${m}`))}
        {select(t("operator"), operator, setOperator, ["above", "below"] as const, (o) => tRule(`operators.${o}`))}
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("value")}</span>
          <input className={inputClass} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold text-neutral">{t("window")}</span>
            <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          {select(t("unit"), unit, setUnit, ["hours", "days"] as const, (u) => t(`units.${u}`))}
        </div>
        <div className="sm:col-span-2">
          {select(t("action"), action, setAction, conditionActions, (a) => tRule(`actions.${a}`))}
          {(action === "shift_budget" || action === "pause_campaign") && (
            <small className="mt-1 block text-[9px] text-text-subtle">{t("approvalHint")}</small>
          )}
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[10px] font-extrabold text-neutral">{t("platforms")}</legend>
          <div className="flex flex-wrap gap-2">
            {adPlatformOrder.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px]">
                <input
                  type="checkbox"
                  className="accent-[#6259d6]"
                  checked={platforms.includes(platform)}
                  onChange={() =>
                    setPlatforms((c) => (c.includes(platform) ? c.filter((p) => p !== platform) : [...c, platform]))
                  }
                />
                {tPlatform(`${platform}.name`)}
              </label>
            ))}
          </div>
          <small className="mt-1 block text-[9px] text-text-subtle">{t("allPlatformsHint")}</small>
        </fieldset>
        {invalid && (
          <p role="alert" className="text-[10px] text-[#c2413d] sm:col-span-2">
            {t("invalid")}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2 border-t border-[#efedf4] pt-4 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t(rule ? "save" : "submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
