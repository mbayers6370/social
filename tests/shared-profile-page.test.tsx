import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SharedProfilePage from "@/app/people/[username]/page";
import {
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { SocialError } from "@/server/social/errors";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  limit: vi.fn(),
  db: vi.fn(),
}));
vi.mock("@/server/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireAccountSession: mocks.session,
    UnauthorizedError,
    EmailVerificationRequiredError: class extends UnauthorizedError {},
  };
});
vi.mock("@/server/db", () => ({ getDb: mocks.db }));
vi.mock("@/server/social/service", () => ({
  SocialService: class {
    profileIdByUsername = mocks.resolve;
  },
}));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: mocks.limit,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.session.mockResolvedValue({ subject: "verified-subject" });
  mocks.resolve.mockResolvedValue("saved-member");
});
afterEach(() => vi.unstubAllEnvs());
const open = (username = "Matt") =>
  SharedProfilePage({ params: Promise.resolve({ username }) });

it("resolves the lowercase username using the verified subject and opens the existing profile", async () => {
  await expect(open()).rejects.toThrow("redirect:/app?person=saved-member");
  expect(mocks.limit).toHaveBeenCalledWith("read", "verified-subject");
  expect(mocks.resolve).toHaveBeenCalledWith("verified-subject", "matt");
});
it("preserves the shared destination when the verified session has ended", async () => {
  mocks.session.mockRejectedValueOnce(new UnauthorizedError());
  await expect(open()).rejects.toThrow(
    "redirect:/sign-in?redirect_url=%2Fpeople%2Fmatt",
  );
  expect(mocks.db).not.toHaveBeenCalled();
});
it("requires email verification before resolving a profile", async () => {
  mocks.session.mockRejectedValueOnce(new EmailVerificationRequiredError());
  await expect(open()).rejects.toThrow("redirect:/onboarding");
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it("does not distinguish blocked, missing or inactive target profiles", async () => {
  mocks.resolve.mockRejectedValueOnce(new SocialError(404, "PRIVATE_CANARY"));
  await expect(open()).rejects.toThrow("NOT_FOUND");
});
it("keeps an inactive viewer behind the existing account gate", async () => {
  mocks.resolve.mockRejectedValueOnce(new SocialError(403, "Inactive"));
  await expect(open()).rejects.toThrow("redirect:/app");
});
it("fails closed when authentication or lookup is unavailable", async () => {
  mocks.session.mockRejectedValueOnce(Error("PRIVATE_PROVIDER_CANARY"));
  render(await open());
  expect(screen.getByRole("heading")).toHaveTextContent(
    "This profile couldn’t be loaded.",
  );
  expect(document.body).not.toHaveTextContent("CANARY");
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it.each(["@matt", "ma", "matt/other", "a".repeat(25)])(
  "rejects invalid address %s before reading any account",
  async (username) => {
    await expect(open(username)).rejects.toThrow("NOT_FOUND");
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  },
);
it("honors the private-backend gate before reading a session", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "");
  await expect(open()).rejects.toThrow("NOT_FOUND");
  expect(mocks.session).not.toHaveBeenCalled();
});
