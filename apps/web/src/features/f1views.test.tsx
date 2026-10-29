// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/ads/campaigns",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const slow = { timeout: 3000 };

// Fresh modules per test, so the mock API starts from the design's sample data.
// The page sits inside the create-campaign provider, as it does in the shell.
async function show(load: () => Promise<React.ComponentType>) {
  const Page = await load();
  const { ToastProvider } = await import("@/components/ui");
  const { CreateCampaignProvider } = await import("./campaigns/CreateCampaign");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <CreateCampaignProvider>
          <Page />
        </CreateCampaignProvider>
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

const campaignsPage = async () => (await import("./campaigns/CampaignsPage")).CampaignsPage;
const rowNames = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("strong")?.textContent);

beforeEach(() => vi.resetModules());
afterEach(cleanup);

describe("Campaigns table", () => {
  it("lists every campaign and filters by platform", async () => {
    await show(campaignsPage);
    await screen.findByText("Spring launch · Berlin", {}, slow);
    expect(rowNames()).toHaveLength(4);
    fireEvent.click(screen.getByRole("tab", { name: /Meta Ads/ }));
    expect(rowNames()).toEqual(["Studio awareness"]);
    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    expect(rowNames()).toHaveLength(4);
  });

  it("shows the summary from the data", async () => {
    await show(campaignsPage);
    await screen.findByText("Spring launch · Berlin", {}, slow);
    const active = screen.getByText("Active campaigns").parentElement!;
    expect(within(active).getByText("3")).toBeTruthy();
  });
});

describe("Campaign drawer", () => {
  it("shows details and pauses only after confirming", async () => {
    await show(campaignsPage);
    fireEvent.click(await screen.findByRole("button", { name: "Open Spring launch · Berlin" }, slow));
    const drawer = await screen.findByRole("dialog", { name: "Spring launch · Berlin" });
    expect(within(drawer).getByText("Qualified lead generation")).toBeTruthy();
    expect(within(drawer).getByText("412,800")).toBeTruthy();
    expect(await within(drawer).findByText("What happens next")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: /Pause campaign/ }));
    const confirm = await screen.findByRole("dialog", { name: "Pause this campaign?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pause this campaign?" })).toBeNull());
    expect(within(drawer).getByText("Live")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: /Pause campaign/ }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Pause this campaign?" })).getByRole("button", { name: "Pause campaign" }));
    expect(await screen.findByText("Spring launch · Berlin paused.", {}, slow)).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Spring launch · Berlin" })).getByRole("button", { name: /Resume campaign/ })).toBeTruthy(), slow);
  });

  it("a draft has no pause button", async () => {
    await show(campaignsPage);
    fireEvent.click(await screen.findByRole("button", { name: "Open B2B pipeline · Q4" }, slow));
    const drawer = await screen.findByRole("dialog", { name: "B2B pipeline · Q4" });
    expect(within(drawer).queryByRole("button", { name: /Pause|Resume/ })).toBeNull();
  });
});

describe("Create campaign pop-up", () => {
  it("validates, saves a draft and shows it in the table", async () => {
    await show(campaignsPage);
    await screen.findByText("Spring launch · Berlin", {}, slow);
    fireEvent.click(screen.getByRole("button", { name: /Create campaign/ }));
    const dialog = await screen.findByRole("dialog", { name: "Start a connected campaign." });
    await waitFor(() => expect(within(dialog).getByLabelText("Monthly budget (EUR)")).toBeTruthy(), slow);

    fireEvent.change(within(dialog).getByLabelText("Monthly budget (EUR)"), { target: { value: "lots" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), { target: { value: "2026-11-10" } });
    fireEvent.change(within(dialog).getByLabelText("End date (optional)"), { target: { value: "2026-11-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save campaign draft" }));
    expect(await within(dialog).findByText("Enter a campaign name")).toBeTruthy();
    expect(within(dialog).getByText("Enter an amount, e.g. 2500")).toBeTruthy();
    expect(within(dialog).getByText("The end date is before the start date")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Campaign name"), { target: { value: "Winter promo" } });
    fireEvent.change(within(dialog).getByLabelText("Advertising channel"), { target: { value: "meta_ads" } });
    fireEvent.change(within(dialog).getByLabelText("Monthly budget (EUR)"), { target: { value: "1500,50" } });
    fireEvent.change(within(dialog).getByLabelText("End date (optional)"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save campaign draft" }));

    expect(await screen.findByText("Winter promo saved as a draft.", {}, slow)).toBeTruthy();
    await waitFor(() => expect(rowNames()).toContain("Winter promo"), slow);
    const { api } = await import("@/lib/api");
    const saved = (await api.campaigns.list({ pageSize: 100 })).data.find((c) => c.name === "Winter promo")!;
    expect(saved).toMatchObject({ status: "draft", platform: "meta_ads", budget: { amount: 1500.5, currency: "EUR" }, objective: "Lead generation", endAt: null });
  });
});

describe("Overview", () => {
  it("shows KPIs from GET /overview, the channels and the campaign table", async () => {
    await show(async () => (await import("./overview/OverviewPage")).OverviewPage);
    const { api } = await import("@/lib/api");
    const overview = await api.overview.get(30);
    await waitFor(() => expect(screen.getByTestId("kpi-leads").textContent).toBe(String(overview.leads.value)), slow);
    expect(screen.getByTestId("kpi-spend").textContent).toMatch(/€/);
    expect(screen.getByText("All your acquisition channels, together.")).toBeTruthy();
    expect(await screen.findByText("Studio awareness", {}, slow)).toBeTruthy();
  });
});

describe("niceMax", () => {
  it("rounds the chart's top so the quarters are round numbers", async () => {
    const { niceMax } = await import("./overview/charts");
    expect(niceMax(1976)).toBe(2000);
    expect(niceMax(2100)).toBe(4000);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(450)).toBe(500);
  });
});
