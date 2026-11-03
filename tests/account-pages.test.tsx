import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: vi.fn(),
  owner: vi.fn(),
  config: vi.fn(),
  invitation: vi.fn(),
  founderInvitation: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  requireAccountSession: state.session,
  UnauthorizedError: class extends Error {},
}));
vi.mock("@/server/db", () => ({
  getDb: () => ({ user: { findUnique: state.owner } }),
}));
vi.mock("@/server/account/actions", () => ({
  saveOnboarding: vi.fn(),
  acceptInvitation: vi.fn(),
}));
vi.mock("@/server/account/invitations", () => ({
  readInvitation: state.invitation,
  readFounderSetupInvitation: state.founderInvitation,
}));
vi.mock("@/server/account/config", () => ({
  accountConfiguration: state.config,
}));
vi.mock("@clerk/nextjs", () => ({ useSession: vi.fn(), useClerk: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: state.auth }));
vi.mock("@/features/account/managed-auth-form", () => ({
  ManagedAuthForm: () => <p role="status">Provider signup</p>,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
  useRouter: () => ({ push: vi.fn() }),
}));
import OnboardingPage from "@/app/onboarding/page";
import SignUpPage from "@/app/sign-up/[[...sign-up]]/page";
beforeEach(() => {
  state.auth.mockResolvedValue({ userId: null });
  state.config.mockReturnValue({ configured: true, registrationEnabled: true });
  state.session.mockResolvedValue({
    subject: "user-one",
    verifiedEmail: "one@example.test",
    user: {
      fullName: "Member Name",
      username: "",
      publicMetadata: { marginOnboardingComplete: true },
    },
  });
  state.owner.mockResolvedValue(null);
  state.invitation.mockResolvedValue({ email: "one@example.test" });
  state.founderInvitation.mockResolvedValue(null);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("routes unconfigured development onboarding through the shared preview layout", async () => {
  vi.stubEnv("NODE_ENV", "development");
  state.config.mockReturnValue({
    configured: false,
    registrationEnabled: false,
  });
  await expect(OnboardingPage()).rejects.toThrow(
    "redirect:/preview/onboarding",
  );
  expect(state.session).not.toHaveBeenCalled();
  expect(state.owner).not.toHaveBeenCalled();
});
it("keeps unconfigured production onboarding out of the preview", async () => {
  vi.stubEnv("NODE_ENV", "production");
  state.config.mockReturnValue({
    configured: false,
    registrationEnabled: false,
  });
  await expect(OnboardingPage()).rejects.toThrow("redirect:/sign-in");
  expect(state.session).not.toHaveBeenCalled();
  expect(state.owner).not.toHaveBeenCalled();
});
it("does not accept provider metadata as proof of completed Margin onboarding", async () => {
  render(await OnboardingPage());
  expect(screen.getByLabelText("Username")).toBeVisible();
  expect(screen.getByRole("button", { name: "Save profile" })).toBeVisible();
});
it("offers recovery for a legacy pending account without treating it as active", async () => {
  state.config.mockReturnValue({
    configured: true,
    registrationEnabled: false,
  });
  state.owner.mockResolvedValue({
    account: { onboardedAt: new Date(), status: "PENDING" },
  });
  render(await OnboardingPage());
  expect(
    screen.getByRole("heading", { name: "Your account needs attention." }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
});
it("sends a canonically active, completed account to the member area", async () => {
  state.owner.mockResolvedValue({
    account: { onboardedAt: new Date(), status: "ACTIVE" },
  });
  await expect(OnboardingPage()).rejects.toThrow("redirect:/app");
});
it("never presents onboarding as a way to reactivate a deactivated account", async () => {
  state.owner.mockResolvedValue({
    account: { onboardedAt: new Date(), status: "DEACTIVATED" },
  });
  render(await OnboardingPage());
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Your account is unavailable.",
  );
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
});
it("directs an authenticated but unverified user to email verification", async () => {
  state.session.mockResolvedValue({
    subject: "user-one",
    verifiedEmail: null,
    user: {},
  });
  render(await OnboardingPage());
  expect(screen.getByRole("heading")).toHaveTextContent("Verify your email.");
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  expect(state.founderInvitation).not.toHaveBeenCalled();
});
it("shows a retry without leaking database failures", async () => {
  state.owner.mockRejectedValue(Error("PRIVATE_DATABASE_CANARY"));
  render(await OnboardingPage());
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Account setup is unavailable.",
  );
  expect(screen.getByRole("link", { name: "Try again" })).toBeVisible();
  expect(document.body).not.toHaveTextContent("CANARY");
});

it("recovers an expired invitation cookie before asking for profile details", async () => {
  state.invitation.mockResolvedValue(null);
  render(await OnboardingPage());
  expect(
    screen.getByText(/Reopen your personal invitation email/),
  ).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
});
it("does not disclose the invited email when the signed-in address is different", async () => {
  state.invitation.mockResolvedValue({ email: "private_invited@example.test" });
  render(await OnboardingPage());
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Check your verified email.",
  );
  expect(document.body).not.toHaveTextContent("private_invited");
  expect(screen.getByText(/reopen that invitation email/)).toBeVisible();
});

it("keeps provider signup hidden when registration closes even with an old invitation", async () => {
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
  state.config.mockReturnValue({
    configured: true,
    registrationEnabled: false,
  });
  render(await SignUpPage());
  expect(screen.getByText(/Registration is currently closed/)).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText("Provider signup")).not.toBeInTheDocument();
  expect(state.auth).not.toHaveBeenCalled();
});
it("shows managed signup only after the server invitation gate", async () => {
  render(await SignUpPage());
  expect(screen.getByRole("status")).toHaveTextContent("Provider signup");
});
it("requires a personal link instead of accepting codes through direct signup", async () => {
  state.invitation.mockResolvedValue(null);
  state.auth.mockResolvedValue({ userId: "user-one" });
  render(await SignUpPage());
  expect(
    screen.getByText(/Open the invitation link someone sent you/),
  ).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(state.auth).not.toHaveBeenCalled();
});
it("returns signed-in invited members to canonical onboarding without mounting signup again", async () => {
  state.auth.mockResolvedValue({ userId: "user-one" });
  await expect(SignUpPage()).rejects.toThrow("redirect:/onboarding");
});

it("resumes the verified founder's reserved invitation without requiring a copied URL", async () => {
  state.invitation.mockResolvedValue(null);
  state.founderInvitation.mockResolvedValue("a".repeat(43));
  render(await OnboardingPage());
  expect(state.founderInvitation).toHaveBeenCalledWith(
    "user-one",
    "one@example.test",
  );
  expect(
    screen.getByRole("button", { name: "Continue to account setup" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  expect(document.querySelector('input[name="token"]')).toHaveValue(
    "a".repeat(43),
  );
});
it("keeps founder recovery behind the registration gate even with a reserved invitation", async () => {
  state.invitation.mockResolvedValue(null);
  state.founderInvitation.mockResolvedValue("a".repeat(43));
  state.config.mockReturnValue({
    configured: true,
    registrationEnabled: false,
  });
  render(await OnboardingPage());
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Registration is currently closed.",
  );
  expect(state.founderInvitation).not.toHaveBeenCalled();
});
