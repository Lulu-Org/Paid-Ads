import { useTranslations } from "next-intl";
import type { AdsPageKey } from "@/config/navigation";
import { PageHeader } from "./PageHeader";

// Temporary body for pages nobody has built yet. Replace it when you build the page.
export function ComingSoon({ page }: { page: AdsPageKey }) {
  const t = useTranslations("common");

  return (
    <>
      <PageHeader page={page} />
      <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border-strong bg-surface text-sm text-text-subtle">
        {t("comingSoon")}
      </div>
    </>
  );
}
