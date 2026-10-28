"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  conversionEventCreateSchema,
  conversionSourceSchema,
  type AdPlatform,
  type ConversionEvent,
  type ConversionSource,
} from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { adPlatformOrder } from "@/components/ads";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";

/**
 * The design's "Conversion event" pop-up: what counts as a result, where it comes from, its value
 * (empty = dynamic, the value comes with each conversion) and which platforms receive it.
 */
export function AddEventModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (event: ConversionEvent) => void;
}) {
  const t = useTranslations("tracking.addEvent");
  const tSource = useTranslations("eventSources");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [source, setSource] = useState<ConversionSource>("crm");
  const [value, setValue] = useState("");
  const [platforms, setPlatforms] = useState<AdPlatform[]>(["google_ads"]);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setSource("crm");
    setValue("");
    setPlatforms(["google_ads"]);
    setInvalid(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = value.trim() === "" ? null : Number(value.replace(",", "."));
    const input = {
      name,
      source,
      value: amount === null ? null : { amount, currency: "EUR" },
      platforms,
    };
    const parsed = conversionEventCreateSchema.safeParse(input);
    if (!parsed.success || (amount !== null && !(amount >= 0))) {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      const saved = await api.tracking.createEvent(parsed.data);
      toast(t("saved"));
      reset();
      onSaved(saved);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (platform: AdPlatform) =>
    setPlatforms((current) => (current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform]));

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="mb-4 text-[11px] text-text-muted">{t("description")}</p>
      <form onSubmit={save} noValidate className="grid gap-3.5">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("name")}</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={invalid && name.trim() === "" ? true : undefined}
          />
        </label>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold text-neutral">{t("source")}</span>
            <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as ConversionSource)}>
              {conversionSourceSchema.options.map((s) => (
                <option key={s} value={s}>
                  {tSource(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold text-neutral">{t("value")}</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("valuePlaceholder")}
            />
          </label>
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[10px] font-extrabold text-neutral">{t("platforms")}</legend>
          <div className="flex flex-wrap gap-2">
            {adPlatformOrder.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px]">
                <input
                  type="checkbox"
                  checked={platforms.includes(platform)}
                  onChange={() => toggle(platform)}
                  className="accent-[#6259d6]"
                />
                {tPlatform(`${platform}.name`)}
              </label>
            ))}
          </div>
        </fieldset>
        {invalid && (
          <p role="alert" className="text-[10px] text-[#c2413d]">
            {t("invalid")}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
