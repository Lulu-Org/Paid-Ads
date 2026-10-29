"use client";

import { useState } from "react";
import type { CampaignListItem } from "@lulu/shared";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useCreateCampaign } from "./CreateCampaign";
import type { PlatformFilter } from "./CampaignTable";

// Campaign rows, creatives for the drawer, the platform filter and the open campaign.
// Reloads when a draft is created from the page heading.
export function useCampaigns() {
  const version = useCreateCampaign()?.version ?? 0;
  const list = useApi(() => Promise.all([api.campaigns.list({ pageSize: 100 }), api.creatives.list()]), [version]);
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = list.data?.[0].data;
  return {
    rows,
    creatives: list.data?.[1].data ?? [],
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    filter,
    setFilter,
    open: rows?.find((c) => c.id === openId) ?? null,
    setOpen: (campaign: CampaignListItem | null) => setOpenId(campaign?.id ?? null),
    // After pause/resume: the status changes at once, the totals on the next load.
    onChanged: () => list.reload(),
  };
}
