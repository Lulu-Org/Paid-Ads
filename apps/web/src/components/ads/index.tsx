import { useTranslations } from "next-intl";
import type { AdPlatform } from "@lulu/shared";

// Small pieces the Paid Ads views share (design: platform logos, health cards, section headings).

const platformMarks: Record<AdPlatform, { short: string; className: string }> = {
  // Gradients from the MagicPath design (.ads-platform-logo).
  google_ads: { short: "G", className: "bg-gradient-to-br from-[#4285f4] to-[#34a853] text-white" },
  google_lsa: { short: "L", className: "bg-gradient-to-br from-[#fbbc04] to-[#ea4335] text-white" },
  meta_ads: { short: "M", className: "bg-gradient-to-br from-[#5b5be7] to-[#e84fa8] text-white" },
  linkedin_ads: { short: "in", className: "bg-[#0a66c2] text-[10px] text-white" },
};

/** The platform's letter mark, with the platform name for screen readers. */
export function PlatformMark({ platform }: { platform: AdPlatform }) {
  const t = useTranslations("platforms");
  const mark = platformMarks[platform];
  return (
    <span
      role="img"
      aria-label={t(`${platform}.name`)}
      className={`grid size-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-black ${mark.className}`}
    >
      {mark.short}
    </span>
  );
}

export const adPlatformOrder: AdPlatform[] = ["google_ads", "google_lsa", "meta_ads", "linkedin_ads"];

const healthTones = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-[#2b6e99]",
  warning: "bg-warning-soft text-warning",
} as const;

/** The design's health card: an icon, a label, a big value and a note. */
export function HealthCard({
  tone,
  icon,
  label,
  value,
  note,
}: {
  tone: keyof typeof healthTones;
  icon: string;
  label: string;
  value: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <article className="flex items-start gap-3 rounded-[13px] border border-[#e8e7f0] bg-surface p-5 shadow-card">
      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${healthTones[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] text-text-subtle">{label}</span>
        <strong className="mt-1 block text-[19px] font-semibold tracking-tight text-text-strong">{value}</strong>
        <small className="mt-0.5 block text-[10px] text-text-muted">{note}</small>
      </div>
    </article>
  );
}

/** Eyebrow, title, optional description, and an action on the right. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h2",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        <Tag className="mt-1.5 text-[15px] font-semibold tracking-tight text-text-strong">{title}</Tag>
        {description && <p className="mt-1 max-w-[560px] text-[11px] leading-relaxed text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
