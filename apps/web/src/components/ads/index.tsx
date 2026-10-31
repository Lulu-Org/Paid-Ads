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

/** The design's white card (.ads-card). */
export function AdsCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-[14px] border border-[#e8e7f0] bg-surface shadow-[0_8px_30px_#23234307] ${className}`}>
      {children}
    </section>
  );
}

/** Eyebrow and title at the top of a card, with an optional action on the right (.ads-card-header). */
export function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        <h2 className="mt-[7px] text-[16px] font-medium tracking-[-0.03em] text-[#292a43]">{title}</h2>
        {description && <p className="mt-1 text-[12px] text-[#8b8c9c]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** A KPI tile without a chart (Planning, Reports): label, value and a coloured note. */
export function KpiTile({
  label,
  value,
  note,
  noteTone = "positive",
  testId,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  noteTone?: "positive" | "negative" | "neutral";
  testId?: string;
}) {
  const tone = { positive: "text-[#2b956f]", negative: "text-[#c2413d]", neutral: "text-[#3d3e54]" }[noteTone];
  return (
    <article className="min-h-[144px] rounded-[14px] border border-[#e8e7f0] bg-surface px-[19px] py-[18px] shadow-[0_8px_30px_#23234307]">
      <span className="block text-[10px] text-[#888a9c]">{label}</span>
      <strong className="mt-[13px] block text-[25px] font-semibold tracking-[-0.05em] text-[#24253f]" data-testid={testId}>
        {value}
      </strong>
      {note && <small className={`mt-[5px] block text-[10px] font-semibold ${tone}`}>{note}</small>}
    </article>
  );
}

const stepMarker = {
  done: "border-[#9bdfc4] bg-[#e8faf2] text-[#299c76]",
  current: "border-[#9f95ee] bg-[#f1efff] text-[#6456dc]",
  upcoming: "border-[#dad9e7] bg-surface text-[#999aa8]",
} as const;

/** The design's vertical steps (.ads-planning-timeline): marker, label and detail. */
export function StepList({ steps }: { steps: { label: string; detail: string; status: keyof typeof stepMarker }[] }) {
  return (
    <ol className="mb-[17px]">
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="relative flex min-h-[50px] items-center pl-[34px]">
          {i < steps.length - 1 && <i aria-hidden className="absolute top-7 -bottom-2 left-[9px] w-px bg-[#e8e7ef]" />}
          <b aria-hidden className={`absolute left-0 grid size-[19px] place-items-center rounded-full border text-[10px] ${stepMarker[step.status]}`}>
            {step.status === "done" ? "✓" : step.status === "current" ? "•" : "○"}
          </b>
          <span>
            <strong className="block text-[10px] font-semibold text-[#4c4d60]">{step.label}</strong>
            <small className="mt-[3px] block text-[9px] text-[#a0a1ad]">{step.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

const statusTones = {
  success: { text: "text-[#299c76]", dot: "bg-[#42b98f]" },
  warning: { text: "text-[#b47a2a]", dot: "bg-[#e0a43a]" },
  info: { text: "text-[#3e88d4]", dot: "bg-[#60a7de]" },
  neutral: { text: "text-[#85828f]", dot: "bg-[#b3b1c0]" },
  violet: { text: "text-[#5e53bd]", dot: "bg-[#8b74e8]" },
} as const;

/** The design's status in tables and cards: a small dot and coloured text (.table-success, ● Healthy). */
export function StatusText({ tone, children }: { tone: keyof typeof statusTones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-semibold whitespace-nowrap ${statusTones[tone].text}`}>
      <i aria-hidden className={`size-[5px] rounded-full ${statusTones[tone].dot}`} />
      {children}
    </span>
  );
}
