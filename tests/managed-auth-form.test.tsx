import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  status: "ready",
  fail: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  ClerkLoaded: ({ children }: { children: React.ReactNode }) =>
    ["ready", "degraded"].includes(sdk.status) ? children : null,
  ClerkLoading: ({ children }: { children: React.ReactNode }) =>
    sdk.status === "loading" ? children : null,
  ClerkFailed: ({ children }: { children: React.ReactNode }) =>
    sdk.status === "error" ? children : null,
  ClerkDegraded: ({ children }: { children: React.ReactNode }) =>
    sdk.status === "degraded" ? children : null,
  useClerk: () => ({ status: sdk.status }),
  SignIn: (props: unknown) => {
    sdk.signIn(props);
    if (sdk.fail) throw Error("PRIVATE_PROVIDER_CANARY");
    return <form aria-label="Provider sign-in" />;
  },
  SignUp: (props: unknown) => {
    sdk.signUp(props);
    return <form aria-label="Provider sign-up" />;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { ManagedAuthForm } from "@/features/account/managed-auth-form";
afterEach(() => {
  sdk.status = "ready";
  sdk.fail = false;
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("delegates credentials/recovery to Clerk and fixes post-auth destinations to an internal route", () => {
  const rendered = render(<ManagedAuthForm kind="sign-in" />);
  expect(screen.getByRole("form", { name: "Provider sign-in" })).toBeVisible();
  expect(sdk.signIn).toHaveBeenCalledWith(
    expect.objectContaining({
      withSignUp: false,
      transferable: false,
      forceRedirectUrl: "/app/feed",
      path: "/sign-in",
    }),
  );
  rendered.rerender(<ManagedAuthForm kind="sign-up" />);
  expect(sdk.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      forceRedirectUrl: "/onboarding",
      path: "/sign-up",
    }),
  );
});
it("returns a shared-profile sign-in to that profile while rejecting other destinations", () => {
  const rendered = render(
    <ManagedAuthForm kind="sign-in" destination="/people/matt" />,
  );
  expect(sdk.signIn).toHaveBeenLastCalledWith(
    expect.objectContaining({ forceRedirectUrl: "/people/matt" }),
  );
  rendered.rerender(
    <ManagedAuthForm
      kind="sign-in"
      destination="https://evil.test/people/matt"
    />,
  );
  expect(sdk.signIn).toHaveBeenLastCalledWith(
    expect.objectContaining({ forceRedirectUrl: "/app/feed" }),
  );
});
it.each(["degraded", "error"])(
  "offers an accessible retry and no credential form when the provider is %s",
  (status) => {
    sdk.status = status;
    render(<ManagedAuthForm kind="sign-in" />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Account access" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  },
);
it("replaces an indefinitely loading provider with a retry state", async () => {
  vi.useFakeTimers();
  sdk.status = "loading";
  render(<ManagedAuthForm kind="sign-in" />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Account access" }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading secure account access",
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12_000);
  });
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
it("contains widget failures without exposing provider error details", () => {
  sdk.fail = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ManagedAuthForm kind="sign-in" />);
  expect(screen.getByRole("alert")).not.toHaveTextContent("CANARY");
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
