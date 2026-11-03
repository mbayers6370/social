import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  set: vi.fn(),
  invitation: vi.fn(),
  link: vi.fn(),
  provider: vi.fn(),
  complete: vi.fn(),
  owner: vi.fn(),
  deleteCookie: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: state.auth }));
vi.mock("@/server/auth", () => ({
  requireAccountSession: state.session,
  UnauthorizedError: class extends Error {},
  EmailVerificationRequiredError: class extends Error {},
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: state.set,
    get: () => ({ value: "a".repeat(43) }),
    delete: state.deleteCookie,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Error(`redirect:${url}`);
  },
}));
vi.mock("@/server/account/config", () => ({
  accountConfiguration: () => ({ registrationEnabled: true }),
}));
vi.mock("@/server/db", () => ({
  getDb: () => ({
    user: { findUnique: state.owner },
    invitation: { findUnique: state.invitation },
    invitationLink: { findUnique: state.link },
  }),
}));
vi.mock("@/server/account/invitation-clerk", () => ({
  clerkInvitationProvider: async () => ({}),
}));
vi.mock("@/server/account/invitation-provider", () => ({
  checkProviderInvitation: state.provider,
  synchronizeInvitations: vi.fn(),
}));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  RateLimitError: class extends Error {},
}));
vi.mock("@/features/account/account-controls", () => ({
  AccountControls: () => <button>Sign out</button>,
}));
vi.mock("@/server/account/service", () => ({
  completeAccountOnboarding: state.complete,
  AccountSetupError: class extends Error {},
}));
import { acceptInvitation, saveOnboarding } from "@/server/account/actions";
import ClaimPage from "@/app/invite/claim/[token]/page";
const token = "a".repeat(43);
function details() {
  const form = new FormData();
  form.set("token", token);
  form.set("ticket", "provider-ticket");
  return form;
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  const link = {
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    acceptedCount: 0,
    maxRedemptions: 1,
  };
  state.invitation.mockResolvedValue({
    id: "claim",
    email: "invited@example.test",
    linkId: "link",
    link,
    clerkInvitationId: "invitation",
    expiresAt: link.expiresAt,
    claimedBy: null,
    revokedAt: null,
    founderSubject: null,
  });
  state.link.mockResolvedValue(link);
  state.auth.mockResolvedValue({ userId: null });
  state.session.mockResolvedValue({
    subject: "other",
    verifiedEmail: "other@example.test",
  });
  state.provider.mockResolvedValue(true);
  state.owner.mockResolvedValue(null);
  state.complete.mockResolvedValue({ status: "ACTIVE" });
});
it("blocks another signed-in account before writing the claim cookie or redirecting", async () => {
  state.auth.mockResolvedValue({ userId: "other" });
  expect(await acceptInvitation({ error: "" }, details())).toEqual({
    error: expect.stringMatching(/different account.*Sign out/),
  });
  expect(state.set).not.toHaveBeenCalled();
  expect(state.provider).not.toHaveBeenCalled();
});
it("preserves the anonymous invited signup path and the 30-minute cookie", async () => {
  await expect(acceptInvitation({ error: "" }, details())).rejects.toThrow(
    "redirect:/sign-up?__clerk_ticket=provider-ticket",
  );
  expect(state.set).toHaveBeenCalledWith(
    "margin_invitation",
    token,
    expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1800,
      path: "/",
    }),
  );
  expect(state.session).not.toHaveBeenCalled();
});
it("allows the currently verified invited account to continue", async () => {
  state.auth.mockResolvedValue({ userId: "invited" });
  state.session.mockResolvedValue({
    subject: "invited",
    verifiedEmail: "Invited@Example.test",
  });
  await expect(acceptInvitation({ error: "" }, details())).rejects.toThrow(
    "redirect:/sign-up?",
  );
  expect(state.set).toHaveBeenCalledOnce();
});
it("denies an unverifiable current session without treating it as anonymous", async () => {
  state.auth.mockResolvedValue({ userId: "other" });
  state.session.mockRejectedValue(Error("PRIVATE_PROVIDER_FAILURE"));
  expect(await acceptInvitation({ error: "" }, details())).toEqual({
    error: "Invitations could not be checked. Try again later.",
  });
  expect(state.set).not.toHaveBeenCalled();
});
it("offers account switching before the wrong account can continue", async () => {
  state.auth.mockResolvedValue({ userId: "other" });
  render(
    await ClaimPage({
      params: Promise.resolve({ token }),
      searchParams: Promise.resolve({ __clerk_ticket: "provider-ticket" }),
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Use your invited account." }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Continue to account setup" }),
  ).not.toBeInTheDocument();
  expect(state.set).not.toHaveBeenCalled();
});
it("offers sign-in recovery for an already-used personal link", async () => {
  state.invitation.mockResolvedValue(null);
  render(
    await ClaimPage({
      params: Promise.resolve({ token }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  expect(
    screen.queryByRole("button", { name: "Continue to account setup" }),
  ).not.toBeInTheDocument();
});

function profileDetails() {
  const form = new FormData();
  form.set("name", "Invited Member");
  form.set("username", "invited_member");
  form.set("bio", "");
  form.set("adult", "yes");
  return form;
}
it("enters the member app immediately after a verified invitation and atomic onboarding", async () => {
  state.session.mockResolvedValue({
    subject: "invited",
    verifiedEmail: "invited@example.test",
  });
  await expect(saveOnboarding({ error: "" }, profileDetails())).rejects.toThrow(
    "redirect:/app",
  );
  expect(state.provider).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ id: "claim" }),
    true,
  );
  expect(state.complete).toHaveBeenCalledWith(
    expect.anything(),
    { subject: "invited", verifiedEmail: "invited@example.test" },
    expect.objectContaining({ username: "invited_member" }),
    "a".repeat(43),
  );
  expect(state.deleteCookie).toHaveBeenCalledWith("margin_invitation");
});
it("never activates when Clerk has not accepted the individual invitation", async () => {
  state.provider.mockResolvedValue(false);
  expect(await saveOnboarding({ error: "" }, profileDetails())).toEqual({
    error:
      "Verify your personal invitation email before finishing account setup.",
  });
  expect(state.complete).not.toHaveBeenCalled();
  expect(state.deleteCookie).not.toHaveBeenCalled();
});
