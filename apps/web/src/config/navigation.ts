// Labels live in messages/*.json under "nav" and "modules". Only keys and routes go here.

// Every Paid Ads view from the MagicPath design ("Lulu Paid Ads"), in the design's order.
export const adsPages = [
  { key: "overview", slug: "overview", icon: "⌂" },
  { key: "campaigns", slug: "campaigns", icon: "◉" },
  { key: "planning", slug: "planning", icon: "▤" },
  { key: "audiences", slug: "audiences", icon: "♙" },
  { key: "creatives", slug: "creatives", icon: "▣" },
  { key: "tracking", slug: "tracking", icon: "⌖" },
  { key: "attribution", slug: "attribution", icon: "↗" },
  { key: "reports", slug: "reports", icon: "▥" },
  { key: "automations", slug: "automations", icon: "⌁" },
  { key: "integrations", slug: "integrations", icon: "⇄" },
  { key: "setup", slug: "platform-setup", icon: "⚙︎" },
  { key: "checklist", slug: "launch-checklist", icon: "✓" },
  { key: "operations", slug: "operations", icon: "↻" },
  { key: "billing", slug: "billing", icon: "€" },
  { key: "team", slug: "team", icon: "◌" },
] as const;

export type AdsPageKey = (typeof adsPages)[number]["key"];

// The Paid Ads menu shows every view.
export const adsMenu = adsPages.map((page) => page.key);

export type AdsMenuKey = AdsPageKey;

export const ADS_HOME = "/ads/overview";

// Other Lulu modules, as in the design's rail. They belong to other teams, so they only link out.
export const workspaceModules = [
  { key: "onlinePresence", icon: "▦", href: "#" },
  { key: "accounting", icon: "▤", href: "#" },
  { key: "email", icon: "✉︎", href: "#" },
  { key: "calendar", icon: "◷", href: "#" },
  { key: "crm", icon: "♙", href: "#" },
] as const;

export const extraModules = [
  { key: "marketplace", icon: "⌘", href: "#" },
  { key: "workspaceSettings", icon: "⚙︎", href: "#" },
] as const;

export function adsHref(slug: string) {
  return `/ads/${slug}`;
}

export function findAdsPage(pathname: string) {
  const slug = pathname.split("/")[2];
  return adsPages.find((page) => page.slug === slug);
}

export function adsPage(key: AdsPageKey) {
  return adsPages.find((page) => page.key === key)!;
}

/** The menu item to highlight for a path. */
export function findAdsMenuItem(pathname: string): AdsMenuKey | undefined {
  return findAdsPage(pathname)?.key;
}
