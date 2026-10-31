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

describe("Launch Checklist", () => {
  it("scores the draft campaign 8 / 10 like the design, and shows what blocks launch", async () => {
    await show(async () => (await import("./checklist/LaunchChecklistPage")).LaunchChecklistPage);
    expect(await screen.findByText("8 / 10", {}, slow)).toBeTruthy();
    expect((screen.getByLabelText("Campaign") as HTMLSelectElement).value).toBe("campaign_b2b_q4");
    expect(screen.getByText("Ad account connected, Creative policy review")).toBeTruthy();
    expect(screen.getByText("Connect the ad account under Integrations.")).toBeTruthy();
  });

  it("asks for the budget approval of a campaign above the threshold", async () => {
    await show(async () => (await import("./checklist/LaunchChecklistPage")).LaunchChecklistPage);
    await screen.findByText("8 / 10", {}, slow);
    fireEvent.change(screen.getByLabelText("Campaign"), { target: { value: "campaign_spring_berlin" } });
    expect(await screen.findByText("9 / 10", {}, slow)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Request approvals" }));
    });
    expect(await screen.findByText("Approval requested.", {}, slow)).toBeTruthy();
  });
});

describe("Operations", () => {
  it("shows health, sync jobs, incidents and webhooks, and retries an incident", async () => {
    await show(async () => (await import("./operations/OperationsPage")).OperationsPage);
    expect(await screen.findByText("1,284", {}, slow)).toBeTruthy();
    expect(screen.getByText("99.6% completed successfully")).toBeTruthy();
    expect(await screen.findByText("Retry queued")).toBeTruthy();
    expect(screen.getByText("Lulu ↔ Provider")).toBeTruthy();
    expect(screen.getByText("campaign.updated")).toBeTruthy();
    expect(screen.getByText("98.4%")).toBeTruthy();
    // A consent review needs a person: it links to Audiences instead of retrying.
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/ads/audiences");

    expect(screen.getByText("2 incidents")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(screen.getByText("1 incident")).toBeTruthy(), slow);
  });
});

describe("Billing & Controls", () => {
  it("shows the spend limit, policy, payment and statements", async () => {
    await show(async () => (await import("./billing/BillingPage")).BillingPage);
    expect(await screen.findByText((_, el) => el?.tagName === "STRONG" && el.textContent === "€16,000 / month", {}, slow)).toBeTruthy();
    expect(await screen.findByText("€8,880 used · €7,120 remaining")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Spend limit used" }).getAttribute("aria-valuenow")).toBe("56");
    expect(await screen.findByText("€2,500 per change")).toBeTruthy();
    expect(screen.getByText("Budget and launch changes above this amount need Finance reviewer approval.")).toBeTruthy();
    expect(await screen.findByText(/Visa ···· 2488/)).toBeTruthy();
    expect(await screen.findAllByText("June 2026")).toHaveLength(2);
    // No card entry here.
    expect(screen.queryByLabelText(/Card number/)).toBeNull();
  });

  it("saves a new limit and refuses an empty one", async () => {
    await show(async () => (await import("./billing/BillingPage")).BillingPage);
    await screen.findByText((_, el) => el?.tagName === "STRONG" && el.textContent === "€16,000 / month", {}, slow);
    fireEvent.click(screen.getByRole("button", { name: "Edit limit" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Monthly workspace limit (EUR)");
    fireEvent.change(amount, { target: { value: "" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(within(dialog).getByRole("alert").textContent).toBe("Enter a limit above 0.");
    fireEvent.change(amount, { target: { value: "20,000" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(await screen.findByText("€20,000 / month", {}, slow)).toBeTruthy();
  });
});

describe("Team & Permissions", () => {
  it("shows the team and role matrix, invites a teammate and changes a role", async () => {
    await show(async () => (await import("./team/TeamPage")).TeamPage);
    const members = await screen.findByRole("region", { name: "Team members" }, slow);
    expect(within(members).getByText("Samira Khan")).toBeTruthy();
    expect(within(members).getByText("Finance reviewer")).toBeTruthy();
    // The owner's role cannot be changed.
    const jamie = within(members).getByText("Jamie Morgan").closest("article") as HTMLElement;
    expect(within(jamie).queryByRole("combobox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Invite teammate/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "lena@studio.de" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "analyst" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Send invite" }));
    });
    expect(await within(members).findByText("lena@studio.de", {}, slow)).toBeTruthy();

    const alex = within(members).getByText("Alex Rivera").closest("article") as HTMLElement;
    await act(async () => {
      fireEvent.change(within(alex).getByRole("combobox"), { target: { value: "reviewer" } });
    });
    expect(await screen.findByText("Alex Rivera is now Reviewer.", {}, slow)).toBeTruthy();
  });
});
