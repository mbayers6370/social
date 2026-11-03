// @vitest-environment node
import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getInvitationList: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ invitations: api }),
}));
import { clerkInvitationProvider } from "@/server/account/invitation-clerk";
import { linkUnavailable } from "@/server/account/invitation-links";
it("uses Clerk's individual email invitations, explicit 30-day lifetime and duplicate protection", async () => {
  const provider = await clerkInvitationProvider();
  api.getInvitationList.mockResolvedValue({ data: [] });
  await provider.find("invite-id");
  expect(api.getInvitationList).toHaveBeenCalledWith({
    query: "invite-id",
    limit: 100,
  });
  await provider.create(
    "friend@example.test",
    "https://margin.social/invite/claim/token",
    "claim-id",
  );
  expect(api.createInvitation).toHaveBeenCalledWith({
    emailAddress: "friend@example.test",
    redirectUrl: "https://margin.social/invite/claim/token",
    expiresInDays: 30,
    ignoreExisting: false,
    notify: true,
    publicMetadata: { marginInvitationId: "claim-id" },
  });
  await provider.revoke("invite-id");
  expect(api.revokeInvitation).toHaveBeenCalledWith("invite-id");
});
it("distinguishes expired, withdrawn and used links with a personal recovery route", () => {
  const now = new Date("2026-11-03");
  const link = {
    expiresAt: new Date("2026-11-04"),
    revokedAt: null,
    acceptedCount: 0,
    maxRedemptions: 1,
  };
  expect(linkUnavailable(link, now)).toBeNull();
  expect(linkUnavailable({ ...link, expiresAt: now }, now)).toMatch(
    /expired.*new link/,
  );
  expect(linkUnavailable({ ...link, revokedAt: now }, now)).toMatch(
    /withdrawn.*new link/,
  );
  expect(linkUnavailable({ ...link, acceptedCount: 1 }, now)).toMatch(
    /already been used.*new invitation/,
  );
});
