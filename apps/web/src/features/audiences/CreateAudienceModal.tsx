"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { adPlatformSchema, audienceSourceSchema } from "@lulu/shared";
import { adPlatformOrder } from "@/components/ads";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

const formSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(200, "nameTooLong"),
  source: audienceSourceSchema,
  consentBasis: z.string().trim().min(1, "consentRequired").max(300, "consentTooLong"),
  platforms: z.array(adPlatformSchema).min(1, "platformsRequired"),
});
type FormValues = z.infer<typeof formSchema>;

const input =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

export function CreateAudienceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("audiences.createForm");
  const tAudiences = useTranslations("audiences");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", source: "crm_segment", consentBasis: "", platforms: [] },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = async (values: FormValues) => {
    try {
      await api.audiences.create(values);
      toast(t("saved", { name: values.name }));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const error = (name: keyof FormValues) =>
    errors[name]?.message ? <span id={`audience-${name}-error`} className="text-[10px] text-[#c2413d]">{t(`errors.${errors[name]!.message}`)}</span> : null;
  const aria = (name: keyof FormValues) => ({
    id: `audience-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `audience-${name}-error` : undefined,
  });

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="-mt-2 mb-4 text-[11px] leading-relaxed text-text-muted">{t("description")}</p>
      <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-3.5">
        <div className="grid gap-1.5">
          <label htmlFor="audience-name" className="text-[10px] font-extrabold text-neutral">{t("name")}</label>
          <input className={input} placeholder={t("namePlaceholder")} autoComplete="off" {...register("name")} {...aria("name")} />
          {error("name")}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audience-source" className="text-[10px] font-extrabold text-neutral">{t("source")}</label>
          <select className={input} {...register("source")} {...aria("source")}>
            {audienceSourceSchema.options.map((s) => (
              <option key={s} value={s}>{tAudiences(`sources.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audience-consentBasis" className="text-[10px] font-extrabold text-neutral">{t("consent")}</label>
          <input className={input} placeholder={t("consentPlaceholder")} {...register("consentBasis")} {...aria("consentBasis")} />
          {error("consentBasis")}
        </div>
        <fieldset className="grid gap-1.5" aria-describedby={errors.platforms ? "audience-platforms-error" : undefined}>
          <legend className="mb-1.5 text-[10px] font-extrabold text-neutral">{t("platforms")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {adPlatformOrder.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-[11px] text-text-strong">
                <input type="checkbox" value={p} className="accent-[#6259d6]" {...register("platforms")} />
                {tPlatform(`${p}.name`)}
              </label>
            ))}
          </div>
          {error("platforms")}
        </fieldset>
        <div className="flex gap-2.5 rounded-lg bg-primary-soft p-3 text-[10px] leading-relaxed text-primary-hover">
          <span aria-hidden>✦</span>
          <p>{t("note")}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{tCommon("cancel")}</Button>
          <Button type="submit" loading={isSubmitting}>{t("submit")}</Button>
        </div>
      </form>
    </Modal>
  );
}
