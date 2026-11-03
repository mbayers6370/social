import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import MemberLayout from "@/app/app/layout";
import {
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { SocialError } from "@/server/social/errors";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  identity: vi.fn(),
  protected: vi.fn(),
}));
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("@/server/auth")>()),
  requireAccountSession: mocks.session,
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/member/service", () => ({
  MemberService: class {
    identity = mocks.identity;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
  redirect: (href: string) => {
    throw Error(`REDIRECT:${href}`);
  },
}));
vi.mock("@/features/social/member-provider", () => ({
  MemberProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/auth/protected-session", () => ({
  ProtectedSession: ({
    children,
    sessionId,
  }: {
    children: ReactNode;
    sessionId: string;
  }) => {
    mocks.protected(sessionId);
    return <>{children}</>;
  },
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.session.mockResolvedValue({
    subject: "verified-subject",
    sessionId: "verified-session",
  });
  mocks.identity.mockResolvedValue({ person: { id: "actual-member" } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const load = () => MemberLayout({ children: <p>Private member content</p> });
it("installs the actual identity behind the verified session monitor", async () => {
  render(await load());
  expect(mocks.identity).toHaveBeenCalledWith("verified-subject");
  expect(mocks.protected).toHaveBeenCalledWith("verified-session");
  expect(screen.getByText("Private member content")).toBeVisible();
});
it("keeps pending accounts outside every member page", async () => {
  mocks.identity.mockRejectedValueOnce(
    new SocialError(403, "Account is not active"),
  );
  render(await load());
  expect(
    screen.getByRole("heading", { name: "Your account is waiting." }),
  ).toBeVisible();
  expect(screen.queryByText("Private member content")).not.toBeInTheDocument();
  expect(mocks.protected).not.toHaveBeenCalled();
});
it("redirects expired sessions and unverified accounts without rendering children", async () => {
  mocks.session.mockRejectedValueOnce(new UnauthorizedError());
  await expect(load()).rejects.toThrow(
    "REDIRECT:/sign-in?reason=session-ended",
  );
  mocks.session.mockRejectedValueOnce(new EmailVerificationRequiredError());
  await expect(load()).rejects.toThrow("REDIRECT:/onboarding");
  expect(mocks.identity).not.toHaveBeenCalled();
});
it("fails safely on provider or database outages without leaking errors or substituting preview content", async () => {
  mocks.identity.mockRejectedValueOnce(new Error("PRIVATE_DB_CANARY"));
  render(await load());
  expect(
    screen.getByRole("heading", { name: "Account access is unavailable." }),
  ).toBeVisible();
  expect(document.body).not.toHaveTextContent(/CANARY|Private member content/);
});
it("does no authentication or database work when the member backend is disabled", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "");
  await expect(load()).rejects.toThrow("NOT_FOUND");
  expect(mocks.session).not.toHaveBeenCalled();
});
