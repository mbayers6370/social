import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { PublicShell } from "@/features/public-site/public-shell";
import { sampleIdentity } from "@/features/social/member-preview";

const session = vi.hoisted(() => ({
  ready: true,
  available: true,
  signedIn: true,
  managed: true,
  loginSessionId: "member-session" as string | null,
  leave: vi.fn(),
  manage: vi.fn(),
  enterPreview: vi.fn(),
}));
vi.mock("@/components/auth/account-session", () => ({
  useAccountSession: () => session,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
const request = vi.fn();
const page = () => (
  <PublicShell>
    <h1>Help and safety</h1>
    <p>Public help remains readable.</p>
  </PublicShell>
);
beforeEach(() => {
  Object.assign(session, {
    ready: true,
    available: true,
    signedIn: true,
    managed: true,
    loginSessionId: "member-session",
  });
  request
    .mockReset()
    .mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/member/context"
              ? sampleIdentity
              : { activity: [], nextCursor: null },
          ),
        ),
    );
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("uses member navigation on public pages without signing out or redirecting their content", async () => {
  render(page());
  expect(
    screen.queryByRole("link", { name: "Sign in" }),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByRole("navigation", { name: "Primary" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "margin feed" })).toHaveAttribute(
    "href",
    "/app/feed",
  );
  expect(
    screen.getByRole("heading", { name: "Help and safety" }),
  ).toBeVisible();
  expect(
    screen.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeInTheDocument();
  expect(session.leave).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledWith(
    "/api/member/context",
    expect.objectContaining({ cache: "no-store" }),
  );
});
it("makes no member requests for signed-out visitors and keeps public sign in", () => {
  Object.assign(session, {
    signedIn: false,
    managed: false,
    loginSessionId: null,
  });
  render(page());
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  expect(screen.getByRole("link", { name: "margin home" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(request).not.toHaveBeenCalled();
});
it("waits for session loading instead of flashing a signed-out action", () => {
  Object.assign(session, {
    ready: false,
    available: false,
    signedIn: false,
    managed: false,
    loginSessionId: null,
  });
  render(page());
  expect(screen.getByRole("status")).toHaveTextContent("Loading account");
  expect(
    screen.queryByRole("link", { name: "Sign in" }),
  ).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
it("keeps public help and account recovery available during a member-service outage", async () => {
  request.mockResolvedValue(
    new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }),
  );
  render(page());
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(screen.getByRole("link", { name: "Back to Margin" })).toHaveAttribute(
    "href",
    "/app/feed",
  );
  expect(screen.getByText("Public help remains readable.")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Sign in" }),
  ).not.toBeInTheDocument();
  expect(session.leave).not.toHaveBeenCalled();
});
it("routes signed-in accounts needing activation to setup without granting member navigation", async () => {
  request.mockResolvedValue(
    new Response(JSON.stringify({ error: "Account is not active" }), {
      status: 403,
    }),
  );
  render(page());
  expect(
    await screen.findByRole("link", { name: "Account setup" }),
  ).toHaveAttribute("href", "/onboarding");
  expect(
    screen.queryByRole("navigation", { name: "Primary" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Sign in" }),
  ).not.toBeInTheDocument();
});
it("discards stale identity responses when the session changes and removes member UI after sign out", async () => {
  let finish: (response: Response) => void = () => {};
  request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(page());
  Object.assign(session, { loginSessionId: "another-session" });
  request.mockResolvedValue(
    new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }),
  );
  rerender(page());
  await act(async () => finish(new Response(JSON.stringify(sampleIdentity))));
  expect(
    screen.queryByRole("button", { name: "Profile menu" }),
  ).not.toBeInTheDocument();
  Object.assign(session, {
    signedIn: false,
    managed: false,
    loginSessionId: null,
  });
  rerender(page());
  expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(session.leave).not.toHaveBeenCalled();
});
