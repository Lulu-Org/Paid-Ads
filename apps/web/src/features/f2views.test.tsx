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
  usePathname: () => "/ads/planning",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const slow = { timeout: 3000 };

// Fresh modules per test, so the mock API starts from the design's sample data.
async function show(load: () => Promise<React.ComponentType>) {
  const Page = await load();
  const { ToastProvider } = await import("@/components/ui");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <Page />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return (await import("@/lib/api")).api;
}

beforeEach(() => vi.resetModules());
afterEach(cleanup);

describe("Planning", () => {
  it("shows the plan's numbers from GET /planning", async () => {
    const api = await show(async () => (await import("./planning/PlanningPage")).PlanningPage);
    const planning = await api.planning.get();
    await waitFor(() => expect(screen.getByTestId("planning-leads").textContent).toBe(planning.targetLeads.toLocaleString("en")), slow);
    expect(screen.getByTestId("planning-limit").textContent).toBe("€16,000");
    expect(screen.getByText("100% allocated")).toBeTruthy();
    expect(screen.getByText("€6,000")).toBeTruthy();
    expect(screen.getByText(/target ROAS 4.5x/)).toBeTruthy();
    expect(screen.getByText("Approve scenario")).toBeTruthy();
    expect(screen.getByText("Waiting for approval")).toBeTruthy();
  });

  it("previews a scenario as you type and saves it as a draft", async () => {
    const api = await show(async () => (await import("./planning/PlanningPage")).PlanningPage);
    await screen.findByTestId("planning-leads", {}, slow);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save scenario" }).hasAttribute("disabled")).toBe(false), slow);
    fireEvent.click(screen.getByRole("button", { name: "Save scenario" }));
    const dialog = await screen.findByRole("dialog", { name: "Try a different split." });
    expect(within(dialog).getByTestId("scenario-allocated").textContent).toBe("€16,000");

    fireEvent.change(within(dialog).getByLabelText("Meta Ads (EUR)"), { target: { value: "6500" } });
    expect(within(dialog).getByTestId("scenario-allocated").textContent).toBe("€18,000");
    expect(within(dialog).getByText(/more than the monthly spend limit/)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Meta Ads (EUR)"), { target: { value: "-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save scenario" }));
    expect(within(dialog).getByText("Enter an amount of 0 or more for every channel")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Meta Ads (EUR)"), { target: { value: "2500" } });
    fireEvent.change(within(dialog).getByLabelText("Scenario name"), { target: { value: "Lean June" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save scenario" }));
    expect(await screen.findByText("Lean June saved as a draft.", {}, slow)).toBeTruthy();
    expect((await api.planning.get()).plan).toMatchObject({ name: "Lean June", status: "draft" });
    expect(screen.getByText("Draft")).toBeTruthy();
  });
});

describe("Audiences", () => {
  const page = async () => (await import("./audiences/AudiencesPage")).AudiencesPage;

  it("shows the cards and the controls table", async () => {
    await show(page);
    expect(await screen.findByText("42,810", {}, slow)).toBeTruthy();
    expect(screen.getByText("1.2M")).toBeTruthy();
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getAllByText("Existing customers").length).toBeGreaterThan(0);
  });

  it("refreshes a syncing audience", async () => {
    await show(page);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }, slow));
    expect(await screen.findByText("Lookalike · Studio buyers refreshed.", {}, slow)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Refresh now" })).toBeNull(), slow);
  });

  it("validates and creates an audience", async () => {
    const api = await show(page);
    fireEvent.click(await screen.findByRole("button", { name: /Create audience/ }, slow));
    const dialog = await screen.findByRole("dialog", { name: "Build an audience once, use it everywhere." });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create audience" }));
    expect(await within(dialog).findByText("Enter a name")).toBeTruthy();
    expect(within(dialog).getByText("Say why you may use this audience")).toBeTruthy();
    expect(within(dialog).getByText("Choose at least one channel")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Audience name"), { target: { value: "CRM · Won customers" } });
    fireEvent.change(within(dialog).getByLabelText("Consent basis"), { target: { value: "Marketing consent in CRM" } });
    fireEvent.click(within(dialog).getByLabelText("Meta Ads"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create audience" }));
    expect(await screen.findByText("CRM · Won customers created. The first sync is running.", {}, slow)).toBeTruthy();
    const saved = (await api.audiences.list()).data.find((a) => a.name === "CRM · Won customers");
    expect(saved).toMatchObject({ source: "crm_segment", platforms: ["meta_ads"], syncing: true });
  });
});

describe("Creatives", () => {
  const page = async () => (await import("./creatives/CreativesPage")).CreativesPage;

  it("shows the grid with badges and the creative test", async () => {
    await show(page);
    const card = await screen.findByRole("button", { name: "Open Before / after carousel" }, slow);
    expect(within(card).getByText("Winner")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Open Operations case study" })).getByText("Review")).toBeTruthy();
    expect(screen.getByText("Variant B is leading by 21.1%.")).toBeTruthy();
    expect(screen.getByText("€14.52 CPL")).toBeTruthy();
  });

  it("uploads a creative and rejects files it cannot use", async () => {
    const api = await show(page);
    fireEvent.click(await screen.findByRole("button", { name: /Add creative/ }, slow));
    const dialog = await screen.findByRole("dialog", { name: "Add a creative to the library." });
    const input = within(dialog).getByLabelText("Creative file");

    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(within(dialog).getByText("Use an image, video or PDF")).toBeTruthy();

    fireEvent.change(input, { target: { files: [new File(["video"], "Winter teaser.mp4", { type: "video/mp4" })] } });
    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Winter teaser");
    expect((within(dialog).getByLabelText("Type") as HTMLSelectElement).value).toBe("video");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add creative" }));
    expect(await screen.findByText("Winter teaser added and waiting for approval.", {}, slow)).toBeTruthy();
    const saved = (await api.creatives.list()).data.find((c) => c.name === "Winter teaser");
    expect(saved).toMatchObject({ type: "video", approvalStatus: "pending" });
  });
});

describe("Reports", () => {
  const page = async () => (await import("./reports/ReportsPage")).ReportsPage;

  it("shows KPIs and the channel comparison, and filters by channel", async () => {
    const api = await show(page);
    await waitFor(() => expect(screen.getByTestId("report-leads").textContent).not.toBe(""), slow);
    const all = await api.reports.run({ from: "2026-06-08", to: "2026-07-07", platforms: [] });
    await waitFor(() => expect(screen.getByTestId("report-leads").textContent).toBe(String(all.leads.value)), slow);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 4);

    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.click(screen.getByLabelText("Meta Ads"));
    const meta = await api.reports.run({ from: "2026-06-08", to: "2026-07-07", platforms: ["meta_ads"] });
    await waitFor(() => expect(screen.getByTestId("report-leads").textContent).toBe(String(meta.leads.value)), slow);
    // Header plus the one filtered channel.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2), slow);
  });

  it("schedules the current view with recipients", async () => {
    const api = await show(page);
    fireEvent.click(await screen.findByRole("button", { name: "Schedule report" }, slow));
    await waitFor(() => expect(screen.getByRole("button", { name: "Schedule report" }).hasAttribute("disabled")).toBe(false), slow);
    fireEvent.click(screen.getByRole("button", { name: "Schedule report" }));
    const dialog = await screen.findByRole("dialog", { name: "Send this view on a schedule." });
    fireEvent.change(within(dialog).getByLabelText("Recipients"), { target: { value: "not-an-email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule report" }));
    expect(within(dialog).getByText("Enter a name")).toBeTruthy();
    expect(within(dialog).getByText("Check the email addresses")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Report name"), { target: { value: "Monday numbers" } });
    fireEvent.change(within(dialog).getByLabelText("Recipients"), { target: { value: "a@lulu.demo, b@lulu.demo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule report" }));
    expect(await screen.findByText("Monday numbers scheduled.", {}, slow)).toBeTruthy();
    const saved = (await api.reports.list()).data.find((r) => r.name === "Monday numbers");
    expect(saved).toMatchObject({ schedule: "0 8 * * 1", recipients: ["a@lulu.demo", "b@lulu.demo"], view: { rangeDays: 30, platforms: [] } });
  });

  it("opens and deletes a saved report", async () => {
    await show(page);
    expect(await screen.findByText("Weekly channel summary", {}, slow)).toBeTruthy();
    const row = screen.getByText("Meta monthly results").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete this report?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Meta monthly results deleted.", {}, slow)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Meta monthly results")).toBeNull(), slow);
  });
});

describe("resolveRange", () => {
  it("ends 'last N days' on the newest synced day", async () => {
    const { resolveRange } = await import("./reports/ReportsPage");
    expect(resolveRange({ kind: "last", days: 30 }, "2026-07-07")).toEqual({ from: "2026-06-08", to: "2026-07-07" });
    expect(resolveRange({ kind: "custom", from: "2026-06-01", to: "2026-06-10" }, "2026-07-07")).toEqual({ from: "2026-06-01", to: "2026-06-10" });
  });
});
