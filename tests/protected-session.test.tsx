import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SessionAccess } from "@/components/auth/protected-session";
vi.mock("@clerk/nextjs", () => ({ useClerk: vi.fn(), useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const provider = {
  ready: true,
  available: true,
  signedIn: true,
  sessionId: "session-one",
};
const view = (state = provider) => (
  <SessionAccess expectedSessionId="session-one" provider={state}>
    <p>Protected account content</p>
  </SessionAccess>
);
afterEach(() => vi.unstubAllGlobals());
it("reveals account content only after independently validating the current session", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ sessionId: "session-one" }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(view());
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
  expect(await screen.findByText("Protected account content")).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/auth/session",
    expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
  );
});
it.each([401, 403, 503, 429])(
  "hides existing content after a %s validation response and offers recovery",
  async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ sessionId: "session-one" }))
      .mockResolvedValueOnce(Response.json({}, { status }));
    vi.stubGlobal("fetch", fetcher);
    render(view());
    await screen.findByText("Protected account content");
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(
        screen.queryByText("Protected account content"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: status === 403 ? "Review account setup" : "Return to sign in",
      }),
    ).toBeVisible();
  },
);
it("preserves recovery after an outage without claiming the account is signed out", async () => {
  const user = userEvent.setup();
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(Error("Offline"))
    .mockResolvedValueOnce(Response.json({ sessionId: "session-one" }));
  vi.stubGlobal("fetch", fetcher);
  render(view());
  await screen.findByRole("button", { name: "Try again" });
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Protected account content")).toBeVisible();
});
it("immediately removes private content when the provider ends or switches the session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ sessionId: "session-one" })),
  );
  const rendered = render(view());
  await screen.findByText("Protected account content");
  rendered.rerender(view({ ...provider, signedIn: false }));
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Your session has ended.",
  );
  rendered.rerender(view({ ...provider, sessionId: "session-other" }));
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
});
it("does not reveal content for a response belonging to another session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ sessionId: "session-other" })),
  );
  render(view());
  expect(await screen.findByRole("heading")).toHaveTextContent(
    "Your session has ended.",
  );
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
});
it("cancels an in-flight check when the protected surface unmounts", () => {
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const rendered = render(view());
  const signal = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
    .signal!;
  rendered.unmount();
  expect(signal.aborted).toBe(true);
});

it("requires a fresh server check when a degraded provider becomes available again", async () => {
  let complete: (value: Response) => void = () => {};
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ sessionId: "session-one" }))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetcher);
  const rendered = render(view());
  await screen.findByText("Protected account content");
  rendered.rerender(view({ ...provider, available: false }));
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
  rendered.rerender(view());
  expect(
    screen.queryByText("Protected account content"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
  await act(async () => complete(Response.json({ sessionId: "session-one" })));
  expect(await screen.findByText("Protected account content")).toBeVisible();
});
