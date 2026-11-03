import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountSession } from "@/components/auth/account-session";
import { BrandLink } from "@/components/shared/brand-link";
const login = vi.hoisted(() => ({ id: "", signedIn: true, ready: true }));
vi.mock("@clerk/nextjs", () => ({
  useSession: () => ({
    isLoaded: login.ready,
    isSignedIn: login.signedIn,
    session: login.signedIn ? { id: login.id } : null,
  }),
  useClerk: () => ({ status: "ready", signOut: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  login.id = crypto.randomUUID();
  login.signedIn = true;
  login.ready = true;
});
const Brand = () => (
  <AccountSession enabled>
    <BrandLink animate />
  </AccountSession>
);
it("plays once for a login across navigation/remounts, then plays for a new login", () => {
  const first = render(<Brand />);
  expect(screen.getByRole("link", { name: "margin home" })).toHaveAttribute(
    "data-entrance",
    "true",
  );
  first.unmount();
  const next = render(<Brand />);
  expect(screen.getByRole("link", { name: "margin home" })).not.toHaveAttribute(
    "data-entrance",
  );
  login.id = crypto.randomUUID();
  next.rerender(<Brand />);
  expect(screen.getByRole("link", { name: "margin home" })).toHaveAttribute(
    "data-entrance",
    "true",
  );
});
it("keeps signed-out branding static and does not consume the entrance while auth is loading", () => {
  login.ready = false;
  const view = render(<Brand />);
  expect(screen.getByRole("link")).not.toHaveAttribute("data-entrance");
  login.ready = true;
  view.rerender(<Brand />);
  expect(screen.getByRole("link")).toHaveAttribute("data-entrance", "true");
  login.signedIn = false;
  view.rerender(<Brand />);
  expect(screen.getByRole("link")).not.toHaveAttribute("data-entrance");
});
it("keeps the first animation intact under Strict Mode effect replay", () => {
  render(
    <StrictMode>
      <Brand />
    </StrictMode>,
  );
  expect(screen.getByRole("link")).toHaveAttribute("data-entrance", "true");
});
