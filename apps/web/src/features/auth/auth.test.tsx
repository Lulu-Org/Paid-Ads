// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

const router = { replace: vi.fn(), push: vi.fn() };
let pathname = "/ads/campaigns";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

// Fresh modules each test, so the API client's token and the mock data start clean.
let auth: typeof import("@/lib/auth");
let http: typeof import("@/lib/api/http");
let SignInPage: typeof import("./SignInPage").SignInPage;
let AuthGate: typeof import("./AuthGate").AuthGate;

beforeEach(async () => {
  vi.resetModules();
  router.replace.mockReset();
  pathname = "/ads/campaigns";
  window.localStorage.clear();
  window.history.replaceState(null, "", "/en/login");
  auth = await import("@/lib/auth");
  http = await import("@/lib/api/http");
  ({ SignInPage } = await import("./SignInPage"));
  ({ AuthGate } = await import("./AuthGate"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const show = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe("session storage", () => {
  it("keeps a valid session and drops an expired one", () => {
    auth.startSession({ token: "t1", expiresAt: inAnHour() });
    expect(auth.readSession()?.token).toBe("t1");

    auth.startSession({ token: "t2", expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(auth.readSession()).toBeNull();
    expect(window.localStorage.getItem("lulu.session")).toBeNull();
  });

  it("treats a damaged value as signed out", () => {
    window.localStorage.setItem("lulu.session", "{not json");
    expect(auth.readSession()).toBeNull();
  });

  it("only returns to paths inside the app", () => {
    expect(auth.safeNext("/ads/campaigns")).toBe("/ads/campaigns");
    expect(auth.safeNext("https://evil.example")).toBe("/ads/overview");
    expect(auth.safeNext("//evil.example")).toBe("/ads/overview");
    expect(auth.safeNext(null)).toBe("/ads/overview");
  });
});

describe("Sign-in page", () => {
  it("signs in and returns to the page asked for", async () => {
    window.history.replaceState(null, "", "/en/login?next=%2Fads%2Freports");
    show(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jamie@lulu.demo" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "anything" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/ads/reports"));
    expect(auth.readSession()?.token).toBe("mock-user_jamie");
  });

  it("says the credentials are wrong without saying which", async () => {
    show(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nobody@lulu.demo" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Email or password is incorrect.");
    expect(auth.readSession()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("asks for both fields before calling the API", async () => {
    show(<SignInPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Enter your email and password.");
  });
});

describe("AuthGate", () => {
  it("sends you to sign in, then back", () => {
    show(<AuthGate required>secret page</AuthGate>);
    expect(screen.queryByText("secret page")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fads%2Fcampaigns");
  });

  it("shows the page with a valid session", () => {
    auth.startSession({ token: "t1", expiresAt: inAnHour() });
    show(<AuthGate required>secret page</AuthGate>);
    expect(screen.getByText("secret page")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("signs out when the session expires", () => {
    vi.useFakeTimers();
    auth.startSession({ token: "t1", expiresAt: new Date(Date.now() + 5000).toISOString() });
    show(<AuthGate required>secret page</AuthGate>);
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fads%2Fcampaigns");
    expect(auth.readSession()).toBeNull();
  });

  it("signs out when the API rejects the token", async () => {
    auth.startSession({ token: "t1", expiresAt: inAnHour() });
    show(<AuthGate required>secret page</AuthGate>);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })));
    await expect(http.getOne((await import("zod")).z.unknown(), "/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(auth.readSession()).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fads%2Fcampaigns");
  });

  it("does nothing in full mock mode", () => {
    show(<AuthGate required={false}>sample page</AuthGate>);
    expect(screen.getByText("sample page")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("HTTP client", () => {
  it("does not sign out on a failed login (no token sent yet)", async () => {
    const handler = vi.fn();
    http.setUnauthorizedHandler(handler);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })));
    await expect(http.post("/auth/login", {})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("handles a POST that answers 204 with no body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(http.post("/auth/logout")).resolves.toBeUndefined();
  });
});
