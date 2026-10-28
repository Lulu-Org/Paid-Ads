import type { AvatarTone } from "@/components/ui/Avatar";

// "Jamie Morgan" -> "JM". Works for names in any script; single words give one letter.
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("");
}

const tones: AvatarTone[] = ["violet", "blue", "mint", "peach", "coral"];

// The same id always gets the same avatar colour. The constants (seed 11, factor 193) are
// picked so the design's sample contacts get the colours they have in the MagicPath design.
export function avatarTone(id: string): AvatarTone {
  let hash = 11;
  for (const char of id) hash = (hash * 193 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}
