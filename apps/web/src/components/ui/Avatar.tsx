const tones = {
  violet: "bg-[#e4ddff] text-[#4b3b93]",
  blue: "bg-[#d8ecfa] text-[#2b6e99]",
  mint: "bg-[#daf2e4] text-[#2f7a58]",
  peach: "bg-[#ffe2d2] text-[#b85c3a]",
  coral: "bg-[#ffe1e0] text-[#b45655]",
} as const;

export type AvatarTone = keyof typeof tones;

export function Avatar({
  initials,
  tone = "violet",
  small = false,
}: {
  initials: string;
  tone?: AvatarTone;
  small?: boolean;
}) {
  const size = small ? "size-[27px] rounded-md text-[8px]" : "size-[34px] rounded-[11px] text-[10px]";
  return (
    <span className={`grid flex-none place-items-center font-extrabold ${size} ${tones[tone]}`}>
      {initials}
    </span>
  );
}
