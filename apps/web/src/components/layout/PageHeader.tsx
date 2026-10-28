import { useTranslations } from "next-intl";
import type { AdsPageKey } from "@/config/navigation";

export function PageHeader({
  page,
  actions,
}: {
  page: AdsPageKey;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tPages = useTranslations("pages");

  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
      <div>
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">
          {tPages("eyebrow", { page: t(page) })}
        </span>
        <h1 className="mt-2 mb-1.5 text-[29px] font-semibold tracking-tight text-text">{t(page)}</h1>
        <p className="max-w-[690px] text-xs leading-relaxed text-text-muted">
          {tPages(`${page}.description`)}
        </p>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
