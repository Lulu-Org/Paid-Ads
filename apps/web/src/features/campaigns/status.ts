import type { AdPlatform, CampaignStatus } from "@lulu/shared";
import type { PillTone } from "@/components/ui";

export const statusTone: Record<CampaignStatus, PillTone> = {
  live: "success",
  paused: "warning",
  draft: "neutral",
  ended: "info",
};

// The coloured dot before a campaign name, by platform (design: campaign-dot).
export const platformDot: Record<AdPlatform, string> = {
  google_ads: "#6e61e2",
  google_lsa: "#4c9eed",
  meta_ads: "#d65bb6",
  linkedin_ads: "#9a9caf",
};
