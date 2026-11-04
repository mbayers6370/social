// @vitest-environment node
// Real isolated PostgreSQL; Clerk email delivery/status are controlled doubles.
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  issueInvitationLink,
  invitationToken,
  digestToken,
  availableInvitationSlots,
} from "@/server/account/invitation-links";
import {
  checkProviderInvitation,
  requestInvitationEmail,
  synchronizeInvitations,
  type InvitationProvider,
  type ProviderInvitation,
} from "@/server/account/invitation-provider";
import {
  activateAccount,
  completeAccountOnboarding,
  prepareFounderInvitation,
} from "@/server/account/service";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "shareable invitations with real PostgreSQL",
  () => {
    let db: PrismaClient;
    let owner: { id: string; clerkId: string };
    let provider: InvitationProvider;
    let remote: ProviderInvitation[];
    const now = new Date("2026-11-03T12:00:00Z");
    const input = (extra = {}) => ({ requestId: randomUUID(), ...extra });
    const createdSubjects: string[] = [];
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "55432" ||
        !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
        url.username !== "margin_runtime"
      )
        throw Error("Refusing non-disposable database");
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.href, max: 8 }),
      });
    });
    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
      vi.stubEnv("INVITATION_LINK_SECRET", "fixture-signing-secret-".repeat(3));
      owner = await db.user.create({
        data: {
          clerkId: `inviter-${randomUUID()}`,
          account: {
            create: {
              status: "ACTIVE",
            },
          },
        },
      });
      createdSubjects.push(owner.clerkId);
      remote = [];
      provider = {
        find: vi.fn(async (query) =>
          remote.filter(
            (item) => item.id === query || item.emailAddress === query,
          ),
        ),
        create: vi.fn(async (emailAddress, _url, claimId) => {
          const item = {
            id: `invitation-${randomUUID()}`,
            emailAddress,
            status: "pending",
            publicMetadata: { marginInvitationId: claimId },
          };
          remote.push(item);
          return item;
        }),
        revoke: vi.fn(async (id) => {
          const item = remote.find((entry) => entry.id === id);
          if (item) item.status = "revoked";
        }),
      };
    });
    afterEach(async () => {
      await db.invitation.deleteMany({
        where: {
          OR: [
            { createdBy: owner.id },
            { founderSubject: { in: createdSubjects } },
          ],
        },
      });
      await db.invitationLink.deleteMany({ where: { createdBy: owner.id } });
      await db.user.deleteMany({
        where: { clerkId: { in: createdSubjects.splice(0) } },
      });
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
    afterAll(async () => db.$disconnect());
    const remaining = (at = now) => availableInvitationSlots(db, owner.id, at);
    async function claim(
      token: string,
      email: string,
      subject = `recipient-${randomUUID()}`,
      at = now,
    ) {
      const invitation = await db.invitation.findFirstOrThrow({
        where: { link: { digest: digestToken(token) }, email },
      });
      remote.find((item) => item.id === invitation.clerkInvitationId)!.status =
        "accepted";
      createdSubjects.push(subject);
      return completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        {
          name: "A friend",
          username: `u_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
          bio: "",
        },
        invitationToken("claim", invitation.id),
        at,
      );
    }
    it("atomically issues only three personal links, makes retries idempotent, and uses exact 30-day deadlines", async () => {
      const first = input();
      const responses = await Promise.all(
        [1, 2].map(() => issueInvitationLink(db, owner.clerkId, first, now)),
      );
      expect(responses[0].token).toBe(responses[1].token);
      expect(await remaining()).toBe(2);
      expect(responses[0].link.expiresAt.getTime() - now.getTime()).toBe(
        30 * 86400000,
      );
      expect(responses[0].link.digest).toBe(digestToken(responses[0].token));
      const attempts = await Promise.allSettled(
        [1, 2, 3].map(() =>
          issueInvitationLink(db, owner.clerkId, input(), now),
        ),
      );
      expect(
        attempts.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(2);
      expect(await remaining()).toBe(0);
      expect(
        await db.invitationLink.count({ where: { createdBy: owner.id } }),
      ).toBe(3);
      expect(
        await db.friendship.count({
          where: { OR: [{ lowId: owner.id }, { highId: owner.id }] },
        }),
      ).toBe(0);
    });
    it("stores optional personal labels, preserves them on retry and rejects changed retry details", async () => {
      const named = input({ label: "  Sam  " });
      const first = await issueInvitationLink(db, owner.clerkId, named, now);
      expect(first.link.label).toBe("Sam");
      const stored = await db.invitationLink.findUniqueOrThrow({
        where: { id: first.link.id },
      });
      expect(stored.label).toBe("Sam");
      const retry = await issueInvitationLink(
        db,
        owner.clerkId,
        { ...named, label: "Sam" },
        now,
      );
      expect(retry.link.id).toBe(first.link.id);
      expect(await remaining()).toBe(2);
      await expect(
        issueInvitationLink(
          db,
          owner.clerkId,
          { ...named, label: "Alex" },
          now,
        ),
      ).rejects.toMatchObject({ status: 409 });
      const unnamed = await issueInvitationLink(
        db,
        owner.clerkId,
        input({ label: "  " }),
        now,
      );
      expect(unnamed.link.label).toBeNull();
      await expect(
        issueInvitationLink(
          db,
          owner.clerkId,
          input({ label: "a".repeat(81) }),
          now,
        ),
      ).rejects.toThrow();
    });
    it("allows unlimited founder issuance and denies member community settings or forged roles", async () => {
      await expect(
        issueInvitationLink(
          db,
          owner.clerkId,
          input({ community: true, maxRedemptions: 20 }),
          now,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        issueInvitationLink(
          db,
          owner.clerkId,
          { ...input(), role: "FOUNDER" } as never,
          now,
        ),
      ).rejects.toThrow();
      await db.account.update({
        where: { userId: owner.id },
        data: { role: "FOUNDER", invitationsRemaining: 0 },
      });
      const expiresAt = new Date(now.getTime() + 5 * 86400000).toISOString();
      const issued = await issueInvitationLink(
        db,
        owner.clerkId,
        input({
          community: true,
          maxRedemptions: 20,
          label: "Private launch",
          expiresAt,
        }),
        now,
      );
      expect(issued.link).toMatchObject({
        maxRedemptions: 20,
        label: "Private launch",
      });
      await issueInvitationLink(db, owner.clerkId, input(), now);
      expect(
        await db.invitationLink.count({ where: { createdBy: owner.id } }),
      ).toBe(2);
    });
    it("does not hold a slot when link signing fails and denies pending/deactivated issuers", async () => {
      vi.stubEnv("INVITATION_LINK_SECRET", "");
      await expect(
        issueInvitationLink(db, owner.clerkId, input(), now),
      ).rejects.toThrow();
      expect(await remaining()).toBe(3);
      vi.stubEnv("INVITATION_LINK_SECRET", "s".repeat(43));
      for (const status of ["PENDING", "DEACTIVATED"] as const) {
        await db.account.update({
          where: { userId: owner.id },
          data: { status },
        });
        await expect(
          issueInvitationLink(db, owner.clerkId, input(), now),
        ).rejects.toMatchObject({ status: 403 });
      }
    });
    it("reuses expired and withdrawn slots immediately, ignoring the legacy lifetime balance", async () => {
      await db.account.update({
        where: { userId: owner.id },
        data: { invitationsRemaining: 0, invitationAllowanceGrantedAt: now },
      });
      const links = await Promise.all(
        [1, 2, 3].map(() =>
          issueInvitationLink(db, owner.clerkId, input(), now),
        ),
      );
      await expect(
        issueInvitationLink(db, owner.clerkId, input(), now),
      ).rejects.toMatchObject({ status: 409 });
      await db.invitationLink.update({
        where: { id: links[0].link.id },
        data: { revokedAt: now },
      });
      expect(await remaining()).toBe(1);
      const replacements = await Promise.allSettled(
        [1, 2, 3].map(() =>
          issueInvitationLink(db, owner.clerkId, input(), now),
        ),
      );
      expect(
        replacements.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(await remaining()).toBe(0);
      const deadline = links[1].link.expiresAt;
      expect(await remaining(new Date(deadline.getTime() - 1))).toBe(0);
      expect(await remaining(deadline)).toBe(3);
      await issueInvitationLink(db, owner.clerkId, input(), deadline);
      expect(await remaining(deadline)).toBe(2);
    });
    it("frees exactly one slot on completed acceptance and never refills it on a repeated claim", async () => {
      const links = await Promise.all(
        [1, 2, 3].map(() =>
          issueInvitationLink(db, owner.clerkId, input(), now),
        ),
      );
      const { token } = links[0];
      const email = "slot@example.test";
      const subject = `recipient-${randomUUID()}`;
      await requestInvitationEmail(
        db,
        provider,
        token,
        email,
        "http://localhost:3000",
        now,
      );
      expect(await remaining()).toBe(0);
      await claim(token, email, subject);
      expect(await remaining()).toBe(1);
      await issueInvitationLink(db, owner.clerkId, input(), now);
      await claim(token, email, subject);
      expect(await remaining()).toBe(0);
      await expect(
        issueInvitationLink(db, owner.clerkId, input(), now),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("never consumes capacity for views or abandoned email claims and binds each Clerk invitation to one email", async () => {
      const { token, link } = await issueInvitationLink(
        db,
        owner.clerkId,
        input(),
        now,
      );
      await requestInvitationEmail(
        db,
        provider,
        token,
        "Friend@Example.test",
        "http://localhost:3000",
        now,
      );
      await requestInvitationEmail(
        db,
        provider,
        token,
        "friend@example.test",
        "http://localhost:3000",
        now,
      );
      await requestInvitationEmail(
        db,
        provider,
        token,
        "other@example.test",
        "http://localhost:3000",
        now,
      );
      expect(provider.create).toHaveBeenCalledTimes(2);
      expect(await remaining()).toBe(2);
      expect(
        (await db.invitationLink.findUniqueOrThrow({ where: { id: link.id } }))
          .acceptedCount,
      ).toBe(0);
      const emailInvite = await db.invitation.findFirstOrThrow({
        where: { linkId: link.id, email: "friend@example.test" },
      });
      await expect(
        completeAccountOnboarding(
          db,
          { subject: "wrong", verifiedEmail: "other@example.test" },
          { name: "Wrong", username: "wrong", bio: "" },
          invitationToken("claim", emailInvite.id),
          now,
        ),
      ).rejects.toThrow("verified email");
      expect(await checkProviderInvitation(provider, emailInvite, true)).toBe(
        false,
      );
      expect(await claim(token, "friend@example.test")).toEqual({
        status: "ACTIVE",
      });
      await synchronizeInvitations(db, provider, now);
      expect(
        remote.find((item) => item.emailAddress === "other@example.test")
          ?.status,
      ).toBe("revoked");
      await expect(
        requestInvitationEmail(
          db,
          provider,
          token,
          "third@example.test",
          "http://localhost:3000",
          now,
        ),
      ).rejects.toMatchObject({ status: 410 });
    });
    it("does not duplicate an address across separate links or transfer an existing claim", async () => {
      const a = await issueInvitationLink(db, owner.clerkId, input(), now);
      const b = await issueInvitationLink(db, owner.clerkId, input(), now);
      await Promise.all(
        [a.token, b.token].map((token) =>
          requestInvitationEmail(
            db,
            provider,
            token,
            "same@example.test",
            "http://localhost:3000",
            now,
          ),
        ),
      );
      expect(provider.create).toHaveBeenCalledTimes(1);
      expect(
        await db.invitation.count({
          where: { email: "same@example.test", revokedAt: null },
        }),
      ).toBe(1);
    });
    it("enforces community capacity atomically when verified recipients complete setup together", async () => {
      await db.account.update({
        where: { userId: owner.id },
        data: { role: "FOUNDER" },
      });
      const { token, link } = await issueInvitationLink(
        db,
        owner.clerkId,
        input({ community: true, maxRedemptions: 2 }),
        now,
      );
      const emails = ["one", "two", "three"].map(
        (name) => `${name}@example.test`,
      );
      for (const email of emails)
        await requestInvitationEmail(
          db,
          provider,
          token,
          email,
          "http://localhost:3000",
          now,
        );
      const results = await Promise.allSettled(
        emails.map((email) => claim(token, email)),
      );
      expect(
        results.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(2);
      expect(
        (await db.invitationLink.findUniqueOrThrow({ where: { id: link.id } }))
          .acceptedCount,
      ).toBe(2);
      expect(
        await db.account.count({
          where: {
            user: { clerkId: { in: createdSubjects.slice(1) } },
            status: "ACTIVE",
          },
        }),
      ).toBe(2);
    });
    it("reconciles an ambiguous Clerk send without another email or invitation", async () => {
      const { token } = await issueInvitationLink(
        db,
        owner.clerkId,
        input(),
        now,
      );
      const create = provider.create;
      provider.create = vi.fn(
        async (email: string, url: string, id: string) => {
          await create(email, url, id);
          throw Error("PRIVATE_PROVIDER_FAILURE");
        },
      );
      await expect(
        requestInvitationEmail(
          db,
          provider,
          token,
          "ambiguous@example.test",
          "http://localhost:3000",
          now,
        ),
      ).rejects.toThrow();
      vi.setSystemTime(new Date(now.getTime() + 180000));
      await requestInvitationEmail(
        db,
        provider,
        token,
        "ambiguous@example.test",
        "http://localhost:3000",
        new Date(),
      );
      expect(provider.create).toHaveBeenCalledTimes(1);
      expect(remote).toHaveLength(1);
      expect(
        (
          await db.invitation.findFirstOrThrow({
            where: { createdBy: owner.id },
          })
        ).clerkInvitationId,
      ).toBe(remote[0].id);
    });
    it("denies expired/revoked claims immediately and retries failed provider revocations", async () => {
      const { token, link } = await issueInvitationLink(
        db,
        owner.clerkId,
        input(),
        now,
      );
      await requestInvitationEmail(
        db,
        provider,
        token,
        "expired@example.test",
        "http://localhost:3000",
        now,
      );
      const later = new Date(link.expiresAt.getTime() + 1);
      await expect(
        claim(token, "expired@example.test", undefined, later),
      ).rejects.toThrow("invitation");
      remote[0].status = "pending";
      provider.revoke = vi
        .fn()
        .mockRejectedValueOnce(Error("provider unavailable"))
        .mockImplementation(async (id) => {
          remote.find((item) => item.id === id)!.status = "revoked";
        });
      await expect(
        synchronizeInvitations(db, provider, later),
      ).rejects.toThrow();
      const revoked = await db.invitation.findFirstOrThrow({
        where: { linkId: link.id },
      });
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.providerRevokedAt).toBeNull();
      await synchronizeInvitations(db, provider, later);
      expect(remote[0].status).toBe("revoked");
      expect(
        (await db.invitation.findUniqueOrThrow({ where: { id: revoked.id } }))
          .providerRevokedAt,
      ).not.toBeNull();
      expect(await remaining(later)).toBe(3);
    });
    it("activates a verified invited account with three invitations atomically, once, without creating a friendship", async () => {
      const { token } = await issueInvitationLink(
        db,
        owner.clerkId,
        input(),
        now,
      );
      const email = "approved@example.test";
      const subject = `approved-${randomUUID()}`;
      await requestInvitationEmail(
        db,
        provider,
        token,
        email,
        "http://localhost:3000",
        now,
      );
      const outcomes = await Promise.all([
        claim(token, email, subject),
        claim(token, email, subject),
      ]);
      expect(outcomes).toEqual([{ status: "ACTIVE" }, { status: "ACTIVE" }]);
      expect(
        (
          await db.invitationLink.findUniqueOrThrow({
            where: { digest: digestToken(token) },
          })
        ).acceptedCount,
      ).toBe(1);
      const member = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
        include: { account: true },
      });
      expect(member.account).toMatchObject({
        status: "ACTIVE",
        role: "MEMBER",
      });
      expect(await availableInvitationSlots(db, member.id, now)).toBe(3);
      expect(await remaining()).toBe(3);
      await activateAccount(db, { subject, verifiedEmail: email }, now);
      await issueInvitationLink(db, subject, input(), now);
      await claim(token, email, subject);
      await activateAccount(db, { subject, verifiedEmail: email }, now);
      expect(await availableInvitationSlots(db, member.id, now)).toBe(2);
      expect(await remaining()).toBe(3);
      await db.invitationLink.deleteMany({ where: { createdBy: member.id } });
      expect(
        await db.friendship.count({
          where: { OR: [{ lowId: member.id }, { highId: member.id }] },
        }),
      ).toBe(0);
    });
    it("bootstraps only the first existing verified identity and keeps founder privileges behind approval", async () => {
      const identity = {
        subject: owner.clerkId,
        verifiedEmail: "founder@example.test",
      };
      await expect(prepareFounderInvitation(db, identity, now)).rejects.toThrow(
        "active community",
      );
      await db.account.update({
        where: { userId: owner.id },
        data: {
          status: "PENDING",
          invitationsRemaining: 0,
          invitationAllowanceGrantedAt: null,
        },
      });
      const token = await prepareFounderInvitation(db, identity, now);
      expect(await prepareFounderInvitation(db, identity, now)).toBe(token);
      await expect(
        prepareFounderInvitation(
          db,
          {
            subject: "another-identity",
            verifiedEmail: "another@example.test",
          },
          now,
        ),
      ).rejects.toThrow("reserved");
      await expect(
        completeAccountOnboarding(
          db,
          { ...identity, subject: "replacement-identity" },
          { name: "Founder", username: "founder", bio: "" },
          token,
          now,
        ),
      ).rejects.toThrow("invitation");
      await completeAccountOnboarding(
        db,
        identity,
        { name: "Founder", username: "founder", bio: "" },
        token,
        now,
      );
      expect(
        await db.account.findUniqueOrThrow({ where: { userId: owner.id } }),
      ).toMatchObject({
        status: "PENDING",
        role: "MEMBER",
        invitationsRemaining: 0,
      });
      await activateAccount(db, identity, now);
      expect(
        await db.account.findUniqueOrThrow({ where: { userId: owner.id } }),
      ).toMatchObject({ status: "ACTIVE", role: "FOUNDER" });
      await issueInvitationLink(
        db,
        identity.subject,
        input({ community: true, maxRedemptions: 10 }),
        now,
      );
      expect(provider.create).not.toHaveBeenCalled();
    });
    it("rotates abandoned delivery reconciliation without starving a later real revocation", async () => {
      const { link } = await issueInvitationLink(
        db,
        owner.clerkId,
        input(),
        now,
      );
      const rows = Array.from({ length: 101 }, (_, index) => ({
        id: index.toString(16).padStart(32, "0"),
        digest: digestToken(`abandoned-${owner.id}-${index}`),
        email: `abandoned-${index}@example.test`,
        linkId: link.id,
        createdBy: owner.id,
        expiresAt: link.expiresAt,
        revokedAt: now,
        deliveryAttemptedAt: now,
        clerkInvitationId: index === 100 ? "last-remote-invitation" : null,
      }));
      await db.invitation.createMany({ data: rows });
      remote.push({
        id: "last-remote-invitation",
        emailAddress: rows[100].email,
        status: "pending",
        publicMetadata: { marginInvitationId: rows[100].id },
      });
      await synchronizeInvitations(db, provider, now);
      expect(provider.revoke).not.toHaveBeenCalled();
      await synchronizeInvitations(
        db,
        provider,
        new Date(now.getTime() + 60000),
      );
      expect(provider.revoke).toHaveBeenCalledWith("last-remote-invitation");
      expect(
        await db.invitation.count({
          where: {
            linkId: link.id,
            clerkInvitationId: null,
            providerRevokedAt: null,
          },
        }),
      ).toBe(100);
    });
  },
);
