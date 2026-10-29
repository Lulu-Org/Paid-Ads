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
  google_ads: "#4285f4",
  google_lsa: "#34a853",
  meta_ads: "#e1306c",
  linkedin_ads: "#64748b",
};
