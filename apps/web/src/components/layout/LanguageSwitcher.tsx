"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, locales } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
      <span aria-hidden>◎</span>
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => router.replace(pathname, { locale: event.target.value }))
        }
        className="cursor-pointer rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[11px] text-text outline-none focus:border-primary"
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
