// @vitest-environment node
import { privateTestDatabaseUrl } from "./helpers/database";
// Actual disposable PostgreSQL; Clerk and Redis are controlled provider doubles.
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
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { PrismaClient } from "@/generated/prisma/client";
import { availableInvitationSlots } from "@/server/account/invitation-links";
const provider = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  user: vi.fn(),
  rate: vi.fn(),
  invitations: vi.fn(),
}));
const jar = vi.hoisted(() => new Map<string, string>());
const cookieSet = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  auth: provider.auth,
  clerkClient: async () => ({
    sessions: { getSession: provider.session },
    users: { getUser: provider.user },
    invitations: { getInvitationList: provider.invitations },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string, options: object) => {
      cookieSet(name, value, options);
      jar.set(name, value);
    },
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: provider.rate,
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
import { getDb } from "@/server/db";
import {
  completeAccountOnboarding,
  activateAccount,
  prepareFounderInvitation,
} from "@/server/account/service";
import { readFounderSetupInvitation } from "@/server/account/invitations";
import { saveOnboarding, acceptInvitation } from "@/server/account/actions";
import { GET as sessionStatus } from "@/app/api/auth/session/route";
import {
  GET as listInvitations,
  POST as issueInvitation,
} from "@/app/api/invitations/route";
import { DELETE as revokeInvitation } from "@/app/api/invitations/[id]/route";
import { RateLimitError } from "@/server/security/rate-limit";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "authentication milestone: real PostgreSQL identity and lifecycle",
  () => {
    let db: PrismaClient;
    let subject: string;
    let code: string;
    let email: string;
    const subjects = () => [
      subject,
      "user_existing",
      "user_competitor",
      "user_replacement",
      "user_inviter",
    ];
    const request = () => new Request("http://localhost:3000/api/auth/session");
    const digest = (code: string) =>
      createHash("sha256").update(code).digest("hex");
    beforeAll(async () => {
      const url = privateTestDatabaseUrl();
      db = new PrismaClient({
        adapter: createDatabaseAdapter(url.href, 8),
      });
    });
    beforeEach(async () => {
      subject = `user_${randomUUID().replaceAll("-", "")}`;
      email = `${subject}@example.test`;
      code = randomBytes(32).toString("base64url");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
      vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
      vi.stubEnv("INVITATION_LINK_SECRET", "s".repeat(43));
      vi.mocked(getDb).mockReturnValue(db);
      provider.auth.mockResolvedValue({
        userId: subject,
        sessionId: "session-fixture",
      });
      provider.session.mockResolvedValue({
        id: "session-fixture",
        userId: subject,
        status: "active",
        expireAt: Date.now() + 3_600_000,
        abandonAt: Date.now() + 3_600_000,
      });
      provider.user.mockResolvedValue({
        id: subject,
        banned: false,
        locked: false,
        primaryEmailAddressId: "email-fixture",
        emailAddresses: [
          {
            id: "email-fixture",
            emailAddress: email,
            verification: { status: "verified" },
          },
        ],
      });
      provider.rate.mockResolvedValue(undefined);
      jar.clear();
      jar.set("margin_invitation", code);
      await db.invitation.create({
        data: {
          digest: digest(code),
          email,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    });
    afterEach(async () => {
      const owners = await db.user.findMany({
        where: { clerkId: { in: subjects() } },
        select: { id: true },
      });
      await db.invitation.deleteMany({
        where: {
          OR: [
            { digest: digest(code) },
            { founderSubject: { in: subjects() } },
            { createdBy: { in: owners.map((owner) => owner.id) } },
          ],
        },
      });
      await db.invitationLink.deleteMany({
        where: { createdBy: { in: owners.map((owner) => owner.id) } },
      });
      await db.user.deleteMany({ where: { clerkId: { in: subjects() } } });
      vi.unstubAllEnvs();
      vi.clearAllMocks();
    });
    afterAll(async () => db?.$disconnect());
    const profile = (username = "margin_member") => ({
      name: "Member Name",
      username,
      bio: "A little introduction.",
    });
    function form(username = "Margin_Member") {
      const form = new FormData();
      form.set("name", "Member Name");
      form.set("username", username);
      form.set("bio", "A little introduction.");
      form.set("adult", "yes");
      return form;
    }
    it.each(["test", "production"])(
      "checks an invitation without consuming it and issues a protected short-lived cookie in %s",
      async (mode) => {
        vi.stubEnv("NODE_ENV", mode);
        if (mode === "production") {
          vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.example");
          vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_fixture");
          vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
        }
        const invitation = new FormData();
        const inviter = await db.user.create({
          data: {
            clerkId: "user_inviter",
            account: { create: { status: "ACTIVE" } },
          },
        });
        const link = await db.invitationLink.create({
          data: {
            digest: digest("link"),
            createdBy: inviter.id,
            requestId: crypto.randomUUID(),
            expiresAt: new Date(Date.now() + 30 * 86400000),
          },
        });
        const claim = await db.invitation.update({
          where: { digest: digest(code) },
          data: { linkId: link.id, clerkInvitationId: "invitation-fixture" },
        });
        provider.invitations.mockResolvedValue({
          data: [
            {
              id: "invitation-fixture",
              emailAddress: email,
              status: "pending",
              publicMetadata: { marginInvitationId: claim.id },
            },
          ],
        });
        invitation.set("token", code);
        invitation.set("ticket", "provider-ticket-fixture");
        await expect(
          acceptInvitation({ error: "" }, invitation),
        ).rejects.toThrow("NEXT_REDIRECT");
        expect(cookieSet).toHaveBeenCalledWith(
          "margin_invitation",
          code,
          expect.objectContaining({
            httpOnly: true,
            secure: mode === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 1800,
          }),
        );
        expect(
          (
            await db.invitation.findUniqueOrThrow({
              where: { digest: digest(code) },
            })
          ).claimedBy,
        ).toBeNull();
      },
    );
    it("persists one immutable provider link and canonical profile; onboarding never activates an account", async () => {
      expect(await saveOnboarding({ error: "" }, form())).toEqual({
        error: "",
        saved: true,
      });
      const owner = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
        include: { account: true },
      });
      expect(owner.account).toMatchObject({
        status: "PENDING",
        displayName: "Member Name",
        username: "margin_member",
        bio: "A little introduction.",
        onboardedAt: expect.any(Date),
        ageConfirmedAt: expect.any(Date),
        emailVerifiedAt: expect.any(Date),
      });
      expect(
        (
          await db.invitation.findUniqueOrThrow({
            where: { digest: digest(code) },
          })
        ).claimedBy,
      ).toBe(subject);
      expect(jar.has("margin_invitation")).toBe(false);
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
      expect(await saveOnboarding({ error: "" }, form("changed_name"))).toEqual(
        { error: "", saved: true },
      );
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(1);
      expect(
        (await db.account.findUniqueOrThrow({ where: { userId: owner.id } }))
          .username,
      ).toBe("margin_member");
    });
    it("keeps registration closed and leaves invitations unclaimed when the flag is off", async () => {
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "closed",
      );
      const invitation = new FormData();
      invitation.set("code", code);
      expect(
        (await acceptInvitation({ error: "" }, invitation)).error,
      ).not.toBe("");
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(0);
      expect(
        (
          await db.invitation.findUniqueOrThrow({
            where: { digest: digest(code) },
          })
        ).claimedBy,
      ).toBeNull();
    });
    it("rejects unverified primary email and wrong bound email before claiming an invitation", async () => {
      provider.user.mockResolvedValue({
        id: subject,
        primaryEmailAddressId: "email-fixture",
        emailAddresses: [
          {
            id: "email-fixture",
            emailAddress: email,
            verification: { status: "unverified" },
          },
        ],
      });
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "Verify",
      );
      await expect(
        completeAccountOnboarding(
          db,
          { subject, verifiedEmail: "other@example.test" },
          profile(),
          code,
        ),
      ).rejects.toThrow("verified email");
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(0);
      expect(
        (
          await db.invitation.findUniqueOrThrow({
            where: { digest: digest(code) },
          })
        ).claimedBy,
      ).toBeNull();
    });
    it("atomically prevents invitation replay by competing verified identities", async () => {
      await db.invitation.update({
        where: { digest: digest(code) },
        data: { email: null },
      });
      const results = await Promise.allSettled(
        [subject, "user_competitor"].map((id, index) =>
          completeAccountOnboarding(
            db,
            { subject: id, verifiedEmail: email },
            profile(`member_${index}`),
            code,
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(1);
      expect(
        await db.account.count({
          where: { user: { clerkId: { in: subjects() } } },
        }),
      ).toBe(1);
      expect(
        (
          await db.account.findFirstOrThrow({
            where: { user: { clerkId: { in: subjects() } } },
          })
        ).status,
      ).toBe("PENDING");
    });
    it("makes concurrent retries idempotent for the same immutable subject", async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          completeAccountOnboarding(
            db,
            { subject, verifiedEmail: email },
            profile(),
            code,
          ),
        ),
      );
      expect(results).toEqual([{ status: "PENDING" }, { status: "PENDING" }]);
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(1);
      expect(
        await db.account.count({
          where: { user: { clerkId: { in: subjects() } } },
        }),
      ).toBe(1);
    });
    it("rolls back a claimed invitation and identity when a username is already taken", async () => {
      await db.user.create({
        data: {
          clerkId: "user_existing",
          account: { create: { username: "margin_member" } },
        },
      });
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "username",
      );
      expect(
        await db.user.findUnique({ where: { clerkId: subject } }),
      ).toBeNull();
      expect(
        (
          await db.invitation.findUniqueOrThrow({
            where: { digest: digest(code) },
          })
        ).claimedBy,
      ).toBeNull();
    });
    it("activates only a completed invited account, and cannot reactivate a deactivated account", async () => {
      await expect(
        activateAccount(db, { subject, verifiedEmail: email }),
      ).rejects.toThrow("completed");
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      expect(
        await activateAccount(db, { subject, verifiedEmail: email }),
      ).toEqual({ status: "ACTIVE" });
      expect(
        await activateAccount(db, { subject, verifiedEmail: email }),
      ).toEqual({ status: "ACTIVE" });
      const user = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
      });
      await db.account.update({
        where: { userId: user.id },
        data: { status: "DEACTIVATED" },
      });
      await expect(
        activateAccount(db, { subject, verifiedEmail: email }),
      ).rejects.toThrow("completed");
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "unavailable",
      );
    });
    it("does not attach a newly created Clerk identity to an existing account with the same email", async () => {
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      await expect(
        completeAccountOnboarding(
          db,
          { subject: "user_replacement", verifiedEmail: email },
          profile("replacement"),
          code,
        ),
      ).rejects.toThrow("invitation");
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(1);
      expect(
        await db.user.findUnique({ where: { clerkId: "user_replacement" } }),
      ).toBeNull();
    });
    it("rejects stale invitations and incomplete age confirmation without leaving an account behind", async () => {
      await db.invitation.update({
        where: { digest: digest(code) },
        data: { expiresAt: new Date(1) },
      });
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "invitation",
      );
      const incomplete = form();
      incomplete.delete("adult");
      expect((await saveOnboarding({ error: "" }, incomplete)).error).toContain(
        "age",
      );
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(0);
    });
    it("fails closed when auth, database or abuse-prevention services are unavailable", async () => {
      provider.rate.mockRejectedValueOnce(new RateLimitError(30));
      expect((await sessionStatus(request())).status).toBe(429);
      provider.session.mockRejectedValueOnce(Error("PRIVATE_PROVIDER_CANARY"));
      const unavailable = await sessionStatus(request());
      expect(unavailable.status).toBe(503);
      expect(await unavailable.text()).not.toContain("CANARY");
      vi.mocked(getDb).mockImplementationOnce(() => {
        throw Error("PRIVATE_DATABASE_CANARY");
      });
      expect((await sessionStatus(request())).status).toBe(503);
      expect(
        await db.user.count({ where: { clerkId: { in: subjects() } } }),
      ).toBe(0);
    });
    it("enforces the onboarding-specific abuse gate before consuming an invitation", async () => {
      provider.rate.mockImplementation(async (policy: string) => {
        if (policy === "onboarding") throw new RateLimitError(30);
      });
      expect((await saveOnboarding({ error: "" }, form())).error).toContain(
        "Wait 30 seconds",
      );
      expect(await db.user.count({ where: { clerkId: subject } })).toBe(0);
      expect(
        (
          await db.invitation.findUniqueOrThrow({
            where: { digest: digest(code) },
          })
        ).claimedBy,
      ).toBeNull();
    });
    it("rejects identity query injection at the session endpoint", async () => {
      const response = await sessionStatus(
        new Request("http://localhost:3000/api/auth/session?userId=forged"),
      );
      expect(response.status).toBe(400);
      expect(provider.auth).not.toHaveBeenCalled();
    });
    it("requires current authentication, operator activation and same-origin access at an existing account API", async () => {
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      const owner = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
      });
      await db.account.update({
        where: { userId: owner.id },
        data: { invitationsRemaining: 1 },
      });
      const invitationRequest = (origin = "http://localhost:3000") =>
        new Request("http://localhost:3000/api/invitations", {
          method: "POST",
          headers: { origin, "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: "12345678-1234-4234-8234-123456789abc",
          }),
        });
      expect((await issueInvitation(invitationRequest())).status).toBe(403);
      await activateAccount(db, { subject, verifiedEmail: email });
      expect(
        (await issueInvitation(invitationRequest("https://foreign.example")))
          .status,
      ).toBe(403);
      provider.session.mockResolvedValueOnce({
        ...(await provider.session()),
        status: "revoked",
      });
      expect((await issueInvitation(invitationRequest())).status).toBe(401);
      expect(await availableInvitationSlots(db, owner.id)).toBe(3);
      const accepted = await issueInvitation(invitationRequest());
      expect(accepted.status).toBe(201);
      expect(accepted.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await availableInvitationSlots(db, owner.id)).toBe(2);
      await db.account.update({
        where: { userId: owner.id },
        data: { status: "DEACTIVATED" },
      });
      expect((await issueInvitation(invitationRequest())).status).toBe(403);
    });
    it("rechecks revocation and account deactivation instead of trusting a previously valid token", async () => {
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      const current = await sessionStatus(request());
      expect(current.status).toBe(200);
      expect(await current.json()).toEqual({ sessionId: "session-fixture" });
      expect(current.headers.get("Cache-Control")).toBe("private, no-store");
      provider.session.mockResolvedValueOnce({
        id: "session-fixture",
        userId: subject,
        status: "revoked",
        expireAt: Date.now() + 1000,
        abandonAt: Date.now() + 1000,
      });
      expect((await sessionStatus(request())).status).toBe(401);
      const user = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
      });
      await db.account.update({
        where: { userId: user.id },
        data: { status: "DEACTIVATED" },
      });
      expect((await sessionStatus(request())).status).toBe(403);
    });
    it("enforces founder-only controls and returns recoverable links without identity or bearer digests", async () => {
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      await activateAccount(db, { subject, verifiedEmail: email });
      const owner = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
      });
      const issue = (input: object) =>
        issueInvitation(
          new Request("http://localhost:3000/api/invitations", {
            method: "POST",
            headers: {
              origin: "http://localhost:3000",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          }),
        );
      expect(
        (
          await issue({
            requestId: randomUUID(),
            community: true,
            maxRedemptions: 20,
          })
        ).status,
      ).toBe(403);
      expect(
        (await issue({ requestId: randomUUID(), role: "FOUNDER" })).status,
      ).toBe(400);
      const personal = await issue({ requestId: randomUUID() });
      expect(personal.status).toBe(201);
      const link = await personal.json();
      expect(link.url).toMatch(
        /^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{43}$/,
      );
      const listed = await listInvitations(
        new Request("http://localhost:3000/api/invitations"),
      );
      expect(listed.status).toBe(200);
      const summary = await listed.json();
      expect(summary).toMatchObject({
        founder: false,
        remaining: 2,
        links: [{ id: link.id, url: link.url }],
      });
      expect(JSON.stringify(summary)).not.toMatch(
        /clerkId|digest|email|requestId/,
      );
      await db.account.update({
        where: { userId: owner.id },
        data: { role: "FOUNDER" },
      });
      expect(
        (
          await issue({
            requestId: randomUUID(),
            community: true,
            maxRedemptions: 20,
            label: "Launch",
          })
        ).status,
      ).toBe(201);
      expect(await availableInvitationSlots(db, owner.id)).toBe(2);
    });
    it("uses the same 30-minute cookie and pending approval for explicitly reserved first-founder setup", async () => {
      const token = await prepareFounderInvitation(db, {
        subject,
        verifiedEmail: email,
      });
      const formData = new FormData();
      formData.set("token", token);
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
      expect((await acceptInvitation({ error: "" }, formData)).error).not.toBe(
        "",
      );
      expect(cookieSet).not.toHaveBeenCalled();
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
      await expect(acceptInvitation({ error: "" }, formData)).rejects.toThrow(
        "NEXT_REDIRECT",
      );
      expect(cookieSet).toHaveBeenCalledWith(
        "margin_invitation",
        token,
        expect.objectContaining({
          maxAge: 1800,
          httpOnly: true,
          sameSite: "lax",
        }),
      );
      expect(
        await saveOnboarding({ error: "" }, form("founder_profile")),
      ).toEqual({ error: "", saved: true });
      const owner = await db.user.findUniqueOrThrow({
        where: { clerkId: subject },
        include: { account: true },
      });
      expect(owner.account).toMatchObject({
        status: "PENDING",
        role: "MEMBER",
        invitationsRemaining: 0,
      });
      await activateAccount(db, { subject, verifiedEmail: email });
      expect(
        (await db.account.findUniqueOrThrow({ where: { userId: owner.id } }))
          .role,
      ).toBe("FOUNDER");
      expect(provider.invitations).not.toHaveBeenCalled();
    });
    it("isolates invitation history and revocation to their authenticated owner", async () => {
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: email },
        profile(),
        code,
      );
      await activateAccount(db, { subject, verifiedEmail: email });
      const issued = await issueInvitation(
        new Request("http://localhost:3000/api/invitations", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        }),
      );
      const link = await issued.json();
      const revoke = () =>
        revokeInvitation(
          new Request(`http://localhost:3000/api/invitations/${link.id}`, {
            method: "DELETE",
            headers: { origin: "http://localhost:3000" },
          }),
          { params: Promise.resolve({ id: link.id }) },
        );
      const originalAuth = await provider.auth();
      const originalSession = await provider.session();
      const originalUser = await provider.user();
      await db.user.create({
        data: {
          clerkId: "user_competitor",
          account: { create: { status: "ACTIVE" } },
        },
      });
      provider.auth.mockResolvedValue({
        ...originalAuth,
        userId: "user_competitor",
      });
      provider.session.mockResolvedValue({
        ...originalSession,
        userId: "user_competitor",
      });
      provider.user.mockResolvedValue({
        ...originalUser,
        id: "user_competitor",
      });
      expect((await revoke()).status).toBe(404);
      expect(
        (
          await listInvitations(
            new Request(
              `http://localhost:3000/api/invitations?before=${link.id}`,
            ),
          )
        ).status,
      ).toBe(404);
      expect(
        (await db.invitationLink.findUniqueOrThrow({ where: { id: link.id } }))
          .revokedAt,
      ).toBeNull();
      provider.auth.mockResolvedValue(originalAuth);
      provider.session.mockResolvedValue(originalSession);
      provider.user.mockResolvedValue(originalUser);
      expect((await revoke()).status).toBe(200);
      expect(
        (await db.invitationLink.findUniqueOrThrow({ where: { id: link.id } }))
          .revokedAt,
      ).not.toBeNull();
      expect((await revoke()).status).toBe(200);
      const refreshed = await listInvitations(
        new Request("http://localhost:3000/api/invitations"),
      );
      expect(await refreshed.json()).toMatchObject({
        remaining: 3,
        links: [{ id: link.id, revoked: true }],
      });
    });
    it("recovers founder setup only for the reserved verified identity while its invitation remains live", async () => {
      const token = await prepareFounderInvitation(db, {
        subject,
        verifiedEmail: email,
      });
      expect(await readFounderSetupInvitation(subject, email)).toBe(token);
      expect(
        await readFounderSetupInvitation("user_competitor", email),
      ).toBeNull();
      expect(
        await readFounderSetupInvitation(subject, "different@example.test"),
      ).toBeNull();
      const invitation = await db.invitation.findUniqueOrThrow({
        where: { digest: digest(token) },
      });
      await db.invitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(0) },
      });
      expect(await readFounderSetupInvitation(subject, email)).toBeNull();
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: new Date(),
        },
      });
      expect(await readFounderSetupInvitation(subject, email)).toBeNull();
      await db.invitation.update({
        where: { id: invitation.id },
        data: { revokedAt: null, claimedBy: subject },
      });
      expect(await readFounderSetupInvitation(subject, email)).toBeNull();
      expect(
        await db.user.findUnique({ where: { clerkId: subject } }),
      ).toBeNull();
    });
  },
);
