import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { adsPages } from "@/config/navigation";

// One route per Paid Ads view. When you build a view, give it its own folder (e.g. ads/campaigns/
// page.tsx rendering features/campaigns/CampaignsPage); that folder wins over this catch-all.
export function generateStaticParams() {
  return adsPages.map((page) => ({ view: page.slug }));
}

export default async function AdsView({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const page = adsPages.find((p) => p.slug === view);
  if (!page) notFound();
  return <ComingSoon page={page.key} />;
}
