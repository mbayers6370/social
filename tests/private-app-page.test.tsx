import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppPage from "@/app/app/page";
import { SocialError } from "@/server/social/errors";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  account: vi.fn(),
  profile: vi.fn(),
  getDb: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: mocks.limit,
}));
vi.mock("@/server/social/service", () => ({
  SocialService: class {
    account = mocks.account;
    profile = mocks.profile;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/features/social/private-profile", () => ({
  PrivateProfile: ({ data }: { data: { profile: { name: string } } }) => (
    <h1>{data.profile.name}</h1>
  ),
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.requireUser.mockResolvedValue("verified-subject");
  mocks.account.mockResolvedValue({
    id: "internal-owner",
    accountStatus: "ACTIVE",
  });
  mocks.profile.mockResolvedValue({
    viewerId: "internal-owner",
    profile: { id: "internal-owner", name: "Saved member" },
  });
});
afterEach(() => vi.unstubAllEnvs());
it("keeps the member area disabled before authentication/database access", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "");
  await expect(AppPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(mocks.requireUser).not.toHaveBeenCalled();
  expect(mocks.getDb).not.toHaveBeenCalled();
});
it("lets an authentication redirect propagate instead of rendering private or sample content", async () => {
  mocks.requireUser.mockRejectedValueOnce(new Error("SIGN_IN_REDIRECT"));
  await expect(AppPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "SIGN_IN_REDIRECT",
  );
  expect(mocks.getDb).not.toHaveBeenCalled();
});
it("does not load private content for a pending invited account", async () => {
  mocks.account.mockResolvedValueOnce({
    id: "internal-owner",
    accountStatus: "PENDING",
  });
  render(await AppPage({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "Your account is waiting." }),
  ).toBeVisible();
  expect(mocks.profile).not.toHaveBeenCalled();
});
it("uses the verified subject and actual account ID for the default profile", async () => {
  render(await AppPage({ searchParams: Promise.resolve({}) }));
  expect(mocks.profile).toHaveBeenCalledWith(
    "verified-subject",
    "internal-owner",
    undefined,
    undefined,
  );
  expect(screen.getByRole("heading", { name: "Saved member" })).toBeVisible();
});
it("rejects client actor fields and unavailable profiles without substituting fixtures", async () => {
  await expect(
    AppPage({ searchParams: Promise.resolve({ viewerId: "forged" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.profile).not.toHaveBeenCalled();
  mocks.profile.mockRejectedValueOnce(new SocialError(404, "Not found"));
  await expect(
    AppPage({ searchParams: Promise.resolve({ person: "other" }) }),
  ).rejects.toThrow("NOT_FOUND");
});
it("shows a recoverable unavailable state when a dependency fails", async () => {
  mocks.limit.mockRejectedValueOnce(new Error("PROVIDER_FAILURE_CANARY"));
  render(await AppPage({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "Your posts are unavailable." }),
  ).toBeVisible();
  expect(document.body).not.toHaveTextContent("CANARY");
  expect(mocks.account).not.toHaveBeenCalled();
});
