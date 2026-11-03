// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readInvitation,
  readFounderSetupInvitation,
  invitationDigest,
} from "@/server/account/invitations";
const fake = vi.hoisted(() => ({
  code: "a".repeat(43),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: fake.code }) }),
}));
vi.mock("@/server/db", () => ({
  getDb: () => ({
    invitation: { findUnique: fake.findUnique, findFirst: fake.findFirst },
  }),
}));
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  fake.code = "a".repeat(43);
});
it("fails closed when registration is disabled or the cookie is malformed", async () => {
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
  expect(await readInvitation()).toBeNull();
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
  fake.code = "short";
  expect(await readInvitation()).toBeNull();
  expect(fake.findUnique).not.toHaveBeenCalled();
});
it("looks up a digest and rejects expiry and another subject’s claimed code", async () => {
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
  const active = {
    id: "invite",
    expiresAt: new Date(Date.now() + 60000),
    claimedBy: null,
  };
  fake.findUnique.mockResolvedValueOnce(active);
  expect(await readInvitation()).toBe(active);
  expect(fake.findUnique).toHaveBeenCalledWith({
    where: { digest: invitationDigest(fake.code) },
  });
  fake.findUnique.mockResolvedValueOnce({ ...active, expiresAt: new Date(0) });
  expect(await readInvitation()).toBeNull();
  fake.findUnique.mockResolvedValue({ ...active, claimedBy: "subject-a" });
  expect(await readInvitation("subject-b")).toBeNull();
  expect(await readInvitation("subject-a")).toMatchObject({ id: "invite" });
  expect(await readInvitation()).toBeNull();
});

it("derives a recovery token only from a live, unclaimed founder reservation bound to the verified identity", async () => {
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
  vi.stubEnv("INVITATION_LINK_SECRET", "s".repeat(43));
  fake.findFirst.mockResolvedValue({ id: "reserved-founder" });
  expect(
    await readFounderSetupInvitation("user-founder", "Owner@Example.test"),
  ).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(fake.findFirst).toHaveBeenCalledWith({
    where: {
      founderSubject: "user-founder",
      email: "owner@example.test",
      linkId: null,
      revokedAt: null,
      claimedBy: null,
      expiresAt: { gt: expect.any(Date) },
    },
    select: { id: true },
  });
  fake.findFirst.mockResolvedValue(null);
  expect(
    await readFounderSetupInvitation("another-user", "owner@example.test"),
  ).toBeNull();
});
it("does not query founder recovery when registration is closed or identity is missing", async () => {
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
  expect(
    await readFounderSetupInvitation("user-founder", "owner@example.test"),
  ).toBeNull();
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
  expect(await readFounderSetupInvitation("", "owner@example.test")).toBeNull();
  expect(await readFounderSetupInvitation("user-founder", "")).toBeNull();
  expect(fake.findFirst).not.toHaveBeenCalled();
});
