import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountSession } from "@/components/auth/account-session";
import { AccountControls } from "@/features/account/account-controls";
const clerk = vi.hoisted(() => ({
  ready: true,
  signOut: vi.fn(),
  openUserProfile: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true, isLoaded: clerk.ready }),
  useClerk: () => clerk,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  vi.clearAllMocks();
  clerk.ready = true;
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
  expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/welcome" });
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
