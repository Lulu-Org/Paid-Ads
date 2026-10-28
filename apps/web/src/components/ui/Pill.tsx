const tones = {
  neutral: "bg-neutral-soft text-neutral",
  violet: "bg-primary-soft text-[#5e53bd]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-[#2b6e99]",
} as const;

export type PillTone = keyof typeof tones;

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-1 text-[9px] font-extrabold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
