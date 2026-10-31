"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { adPlatformSchema, type AdPlatform } from "@lulu/shared";
import { adPlatformOrder } from "@/components/ads";
import { Button, Modal, useToast } from "@/components/ui";
import { api, realAreas } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

// The design's "+ Create campaign" sits in every page heading, so the pop-up lives in the shell.
// Pages that list campaigns read `version` to reload after a new draft is saved.
type CreateCampaignContext = { open: () => void; version: number };
const Context = createContext<CreateCampaignContext | null>(null);

// Null outside the shell (for example in a page's unit test), so callers can hide the button.
export function useCreateCampaign() {
  return useContext(Context);
}

export const objectiveKeys = ["lead_generation", "website_traffic", "sales", "brand_awareness"] as const;

const formSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(200, "nameTooLong"),
    platform: adPlatformSchema,
    budget: z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "budgetInvalid"),
    objective: z.enum(objectiveKeys),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "endBeforeStart", path: ["endDate"] });

type FormValues = z.infer<typeof formSchema>;

const input =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

export function CreateCampaignProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const open = useCallback(() => setOpen(true), []);

  return (
    <Context.Provider value={{ open, version }}>
      {children}
      <CreateCampaignModal open={isOpen} onClose={() => setOpen(false)} onSaved={() => setVersion((v) => v + 1)} />
    </Context.Provider>
  );
}

function CreateCampaignModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("campaigns.create");
  const tPlatform = useTranslations("platforms");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // The budget is in the currency of the platform's ad account.
  const accounts = useApi(() => (open ? api.adAccounts.list() : Promise.resolve(null)), [open]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", platform: "google_ads", budget: "", objective: "lead_generation", startDate: "", endDate: "" },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const platform = watch("platform") as AdPlatform;
  const accountList = accounts.data?.data ?? [];
  const account = accountList.find((a) => a.platform === platform);
  const currency = account?.currency ?? accountList[0]?.currency;
  const sameSource = realAreas.includes("adAccounts") === realAreas.includes("campaigns");

  const submit = async (values: FormValues) => {
    if (!currency) return;
    try {
      await api.campaigns.create({
        platform: values.platform,
        // Only link an account that lives in the same API as the campaign (mock ids mean nothing to the real API).
        adAccountId: sameSource ? (account?.id ?? null) : null,
        name: values.name,
        objective: t(`objectives.${values.objective}`),
        budget: { amount: Number(values.budget.replace(",", ".")), currency },
        startAt: values.startDate ? `${values.startDate}T00:00:00.000Z` : null,
        endAt: values.endDate ? `${values.endDate}T23:59:59.000Z` : null,
      });
      toast(t("saved", { name: values.name }));
      onSaved();
      onClose();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const error = (name: keyof FormValues) =>
    errors[name]?.message ? (
      <span id={`campaign-${name}-error`} className="text-[10px] text-[#c2413d]">
        {t(`errors.${errors[name]!.message}`)}
      </span>
    ) : null;
  const aria = (name: keyof FormValues) => ({
    id: `campaign-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `campaign-${name}-error` : undefined,
  });
  const label = (name: keyof FormValues, text: string) => (
    <label htmlFor={`campaign-${name}`} className="text-[10px] font-extrabold text-neutral">
      {text}
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="-mt-2 mb-4 text-[11px] leading-relaxed text-text-muted">{t("description")}</p>
      <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-3.5">
        <div className="grid gap-1.5">
          {label("name", t("name"))}
          <input className={input} placeholder={t("namePlaceholder")} autoComplete="off" {...register("name")} {...aria("name")} />
          {error("name")}
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            {label("platform", t("channel"))}
            <select className={input} {...register("platform")} {...aria("platform")}>
              {adPlatformOrder.map((p) => (
                <option key={p} value={p}>
                  {tPlatform(`${p}.name`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid content-start gap-1.5">
            {label("budget", currency ? t("budget", { currency }) : t("budgetNoCurrency"))}
            <input className={input} inputMode="decimal" placeholder={t("budgetPlaceholder")} {...register("budget")} {...aria("budget")} />
            {error("budget")}
          </div>
        </div>
        <div className="grid gap-1.5">
          {label("objective", t("objective"))}
          <select className={input} {...register("objective")} {...aria("objective")}>
            {objectiveKeys.map((key) => (
              <option key={key} value={key}>
                {t(`objectives.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            {label("startDate", t("start"))}
            <input type="date" className={input} {...register("startDate")} {...aria("startDate")} />
          </div>
          <div className="grid content-start gap-1.5">
            {label("endDate", t("end"))}
            <input type="date" className={input} {...register("endDate")} {...aria("endDate")} />
            {error("endDate")}
          </div>
        </div>
        <div className="flex gap-2.5 rounded-lg bg-primary-soft p-3 text-[10px] leading-relaxed text-primary-hover">
          <span aria-hidden>✦</span>
          <p>{t("note")}</p>
        </div>
        {!currency && accounts.data && <p className="text-[10px] text-[#c2413d]">{t("noAccount")}</p>}
        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!currency}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
