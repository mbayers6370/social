import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AccountSession,
  useAccountSession,
} from "@/components/auth/account-session";
import { AccountControls } from "@/features/account/account-controls";
const clerk = vi.hoisted(() => ({
  ready: true,
  status: "ready",
  signedIn: true,
  signOut: vi.fn(),
  openUserProfile: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useSession: () => ({
    isSignedIn: clerk.signedIn,
    isLoaded: clerk.ready,
    session: { id: "account-test-session" },
  }),
  useClerk: () => clerk,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  clerk.ready = true;
  clerk.status = "ready";
  clerk.signedIn = true;
});
it("uses the provider to end the signed-in session and return to welcome", async () => {
  clerk.signOut.mockResolvedValueOnce(undefined);
  const user = userEvent.setup();
  render(
    <AccountSession enabled>
      <AccountControls compact />
    </AccountSession>,
  );
  await user.click(screen.getByRole("button", { name: "Account & security" }));
  expect(clerk.openUserProfile).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(clerk.signOut).toHaveBeenCalledWith({
    sessionId: "account-test-session",
    redirectUrl: "/welcome",
  });
  expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
});
it("keeps sign-out retryable when the provider fails", async () => {
  clerk.signOut.mockRejectedValueOnce(new Error("Provider unavailable"));
  const user = userEvent.setup();
  render(
    <AccountSession enabled>
      <AccountControls />
    </AccountSession>,
  );
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn’t sign out. Try again.",
  );
});

it("waits for the verified provider session before offering account exit", () => {
  clerk.ready = false;
  render(
    <AccountSession enabled>
      <AccountControls />
    </AccountSession>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading account…");
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Exit preview" }),
  ).not.toBeInTheDocument();
});

it("does not present a fictional preview identity when authentication is unavailable in a non-preview surface", () => {
  render(
    <AccountSession enabled={false} previewAllowed={false}>
      <AccountControls />
    </AccountSession>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "temporarily unavailable",
  );
  expect(
    screen.queryByRole("button", { name: "Exit preview" }),
  ).not.toBeInTheDocument();
});
it("bounds account loading and recovers only after the provider session is ready", async () => {
  vi.useFakeTimers();
  clerk.ready = false;
  clerk.status = "loading";
  const view = () => (
    <AccountSession enabled>
      <AccountControls />
    </AccountSession>
  );
  const { rerender } = render(view());
  expect(screen.getByRole("status")).toHaveTextContent("Loading account");
  await act(() => vi.advanceTimersByTimeAsync(12_000));
  expect(screen.getByRole("status")).toHaveTextContent(
    "temporarily unavailable",
  );
  expect(screen.getByRole("link", { name: "Return to sign in" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  clerk.ready = true;
  clerk.status = "ready";
  rerender(view());
  expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
});
it("reports account-security failures without exposing provider details", async () => {
  clerk.openUserProfile.mockImplementationOnce(() => {
    throw Error("PRIVATE_PROVIDER_CANARY");
  });
  const user = userEvent.setup();
  render(
    <AccountSession enabled>
      <AccountControls />
    </AccountSession>,
  );
  await user.click(screen.getByRole("button", { name: "Account & security" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Account security could not be opened",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("CANARY");
});
it("does not offer preview exit when the managed provider has no signed-in session", () => {
  clerk.signedIn = false;
  render(
    <AccountSession enabled>
      <AccountControls />
    </AccountSession>,
  );
  expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Exit preview" }),
  ).not.toBeInTheDocument();
});

it("offers preview exit only after an explicit fictional login", async () => {
  function PreviewEntry() {
    const session = useAccountSession();
    return (
      <button onClick={() => session?.enterPreview()}>
        Enter fictional preview
      </button>
    );
  }
  const user = userEvent.setup();
  render(
    <AccountSession enabled={false} previewAllowed>
      <PreviewEntry />
      <AccountControls />
    </AccountSession>,
  );
  expect(
    screen.queryByRole("button", { name: "Exit preview" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Enter fictional preview" }),
  );
  expect(screen.getByRole("button", { name: "Exit preview" })).toBeVisible();
  expect(clerk.signOut).not.toHaveBeenCalled();
});

it("clears the local preview marker when a managed account signs out", async () => {
  function Probe() {
    const session = useAccountSession()!;
    return (
      <>
        <button onClick={session.enterPreview}>Enter sample view</button>
        <button onClick={() => void session.leave()}>Leave account</button>
        <p role="status">{session.signedIn ? "Back to Margin" : "Sign in"}</p>
      </>
    );
  }
  const view = () => (
    <AccountSession enabled>
      <Probe />
    </AccountSession>
  );
  const user = userEvent.setup();
  const { rerender } = render(view());
  await user.click(screen.getByRole("button", { name: "Enter sample view" }));
  await user.click(screen.getByRole("button", { name: "Leave account" }));
  clerk.signedIn = false;
  rerender(view());
  expect(screen.getByRole("status")).toHaveTextContent("Sign in");
});
