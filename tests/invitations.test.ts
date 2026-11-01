// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readInvitation, invitationDigest } from "@/server/account/invitations";
const fake = vi.hoisted(() => ({ code: "a".repeat(43), findUnique: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: fake.code }) }),
}));
vi.mock("@/server/db", () => ({
  getDb: () => ({ invitation: { findUnique: fake.findUnique } }),
}));
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
