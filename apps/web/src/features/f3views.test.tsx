// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/ads/overview",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const slow = { timeout: 3000 };

// Fresh modules per test, so the mock API's in-memory data starts from the design's sample data.
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
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

describe("Tracking", () => {
  it("shows tracking health and the events, adds an event, and builds a tracking link", async () => {
    await show(async () => (await import("./tracking/TrackingPage")).TrackingPage);
    expect(await screen.findByText("8,420", {}, slow)).toBeTruthy();
    expect(screen.getByText("+11.4% compared to yesterday")).toBeTruthy();
    expect(await screen.findByText("Offline sale")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add event/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Event name"), { target: { value: "Signed contract" } });
    fireEvent.change(within(dialog).getByLabelText("Value (EUR)"), { target: { value: "900" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Add event" }));
    });
    expect(await screen.findByText("Signed contract", {}, slow)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Campaign"), { target: { value: "Autumn Sale Berlin" } });
    expect(screen.getByLabelText("Tracking link").textContent).toBe(
      "https://lulu.ai/?utm_source=google&utm_campaign=autumn_sale_berlin&utm_content=search_rsa_b",
    );
  });

  it("refuses an event without a name or platform", async () => {
    await show(async () => (await import("./tracking/TrackingPage")).TrackingPage);
    fireEvent.click(await screen.findByRole("button", { name: /Add event/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Google Ads"));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Add event" }));
    });
    expect(within(dialog).getByRole("alert").textContent).toContain("choose at least one platform");
  });
});

describe("Attribution & Data", () => {
  it("shows quality, revenue by platform and the event mapping, and switches the model", async () => {
    await show(async () => (await import("./attribution/AttributionPage")).AttributionPage);
    expect(await screen.findByText("98.6%", {}, slow)).toBeTruthy();
    expect(screen.getByText("€42,640")).toBeTruthy();
    const byPlatform = screen.getByRole("list", { name: "Attributed revenue by platform" });
    expect(within(byPlatform).getByText("€20,480")).toBeTruthy();
    expect(await screen.findByText("Dynamic")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Attribution model"), { target: { value: "last_touch" } });
    expect((screen.getByLabelText("Attribution model") as HTMLSelectElement).value).toBe("last_touch");
  });
});

describe("Automations", () => {
  it("describes each rule, pauses and resumes it, and lists recent activity", async () => {
    await show(async () => (await import("./automations/AutomationsPage")).AutomationsPage);
    expect(
      await screen.findByText(
        "When cost per lead is above €28 for 3 days, notify the owner and request a budget review.",
        {},
        slow,
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Weekly performance digest").length).toBeGreaterThan(0);
    expect(await screen.findByText("Review requested")).toBeTruthy();
    expect(await screen.findByText("Studio awareness")).toBeTruthy();

    const rules = screen.getByRole("region", { name: "Automation rules" });
    const tracking = within(rules).getByText("Pause on tracking failure").closest("article")!;
    expect(within(tracking as HTMLElement).getByText("Paused")).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(tracking as HTMLElement).getByRole("button", { name: "Resume" }));
    });
    await waitFor(() => expect(within(tracking as HTMLElement).getByText("On")).toBeTruthy(), slow);
  });

  it("creates a rule from the pop-up", async () => {
    await show(async () => (await import("./automations/AutomationsPage")).AutomationsPage);
    fireEvent.click(await screen.findByRole("button", { name: /Create rule/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: "Low ROAS alert" } });
    fireEvent.change(within(dialog).getByLabelText("Metric"), { target: { value: "roas" } });
    fireEvent.change(within(dialog).getByLabelText("Is"), { target: { value: "below" } });
    fireEvent.change(within(dialog).getByLabelText("Value"), { target: { value: "2" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create rule" }));
    });
    expect(await screen.findByText("When ROAS is below 2 for 3 days, notify the campaign owner.", {}, slow)).toBeTruthy();
  });
});

describe("Integrations", () => {
  it("shows each platform's connection and connects LinkedIn", async () => {
    await show(async () => (await import("./integrations/IntegrationsPage")).IntegrationsPage);
    const platforms = await screen.findByRole("region", { name: "Ad platforms" }, slow);
    const linkedin = within(platforms).getByText("LinkedIn Ads").closest("article") as HTMLElement;
    expect(within(linkedin).getByText("Not connected")).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(linkedin).getByRole("button", { name: "Connect" }));
    });
    await waitFor(() => expect(within(linkedin).getByText("Connected")).toBeTruthy(), slow);
    expect(within(linkedin).getByRole("button", { name: "Sync now" })).toBeTruthy();
  });
});

describe("Platform Setup", () => {
  it("shows each channel's account and saves the guardrails", async () => {
    await show(async () => (await import("./setup/PlatformSetupPage")).PlatformSetupPage);
    expect(await screen.findByText("Lulu Growth · 123-456", {}, slow)).toBeTruthy();
    expect(screen.getByText("Lulu Berlin Local")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Edit guardrails →" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("switch", { name: /Auto-tag links/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    const autoTag = (await screen.findAllByText("Auto-tag links")).find((el) => el.tagName === "DT")!;
    await waitFor(() => expect(autoTag.nextElementSibling?.textContent).toBe("Off"), slow);
  });
});
