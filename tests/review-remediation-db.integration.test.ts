// @vitest-environment node
// Actual disposable PostgreSQL + real normalization; Clerk/Redis and object storage are controlled adapters.
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
import sharp from "sharp";
import { privateTestDatabaseUrl } from "./helpers/database";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import { ModerationService } from "@/server/safety/service";
import { calvinEvent } from "./helpers/ticketmaster-fixture";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "independent review remediation",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let moderation: ModerationService;
    let actors: { id: string; clerkId: string }[];
    let now: Date;
    const objects = new Map<string, Uint8Array>();
    const store = {
      put: vi.fn(async (key: string, bytes: Uint8Array) => {
        objects.set(key, bytes);
      }),
      get: vi.fn(async (key: string) => objects.get(key)!),
      delete: vi.fn(async (key: string) => {
        objects.delete(key);
      }),
    };
    beforeAll(() => {
      db = new PrismaClient({
        adapter: createDatabaseAdapter(privateTestDatabaseUrl().href, 8),
      });
    });
    beforeEach(async () => {
      now = new Date("2026-11-03T20:00:00Z");
      objects.clear();
      actors = [];
      for (let index = 0; index < 4; index++)
        actors.push(
          await db.user.create({
            data: {
              clerkId: `review-${randomUUID()}`,
              account: {
                create: {
                  status: "ACTIVE",
                  role: index === 0 ? "FOUNDER" : "MEMBER",
                  displayName: `Review ${index}`,
                  bio: "Private biography canary",
                },
              },
            },
            select: { id: true, clerkId: true },
          }),
        );
      service = new MemberService(db, store, () => now, {
        event: async () => calvinEvent,
        search: async () => ({ events: [calvinEvent], nextPage: null }),
      });
      moderation = new ModerationService(db, store, () => now);
    });
    afterEach(async () => {
      await db.operatorAction.deleteMany({
        where: { operatorId: { in: actors.map((a) => a.id) } },
      });
      await db.safetyReport.deleteMany({
        where: { reporterId: { in: actors.map((a) => a.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: actors.map((a) => a.id) } },
      });
    });
    afterAll(async () => db.$disconnect());
    async function friends(a = 1, b = 2) {
      await service.relationship(actors[a].clerkId, actors[b].id, "request");
      await service.relationship(actors[b].clerkId, actors[a].id, "accept");
    }
    async function reportedPost() {
      await friends();
      const post = await service.createPost(
        actors[1].clerkId,
        "Reported private text",
      );
      const report = await service.createReport(actors[2].clerkId, {
        target: {
          kind: "post",
          id: post.id,
          personId: actors[1].id,
          label: "Post",
        },
        reason: "harmful",
        details: "Please review",
      });
      return { post, report };
    }
    it("denies ordinary, pending and deactivated founders and scopes operator reads to the reported target", async () => {
      const { post, report } = await reportedPost();
      await expect(moderation.reports(actors[1].clerkId)).rejects.toMatchObject(
        { status: 403 },
      );
      await expect(
        moderation.report(actors[3].clerkId, report.id),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.readPost(actors[0].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await moderation.report(actors[0].clerkId, report.id)).target?.body,
      ).toBe("Reported private text");
      await expect(
        moderation.report(actors[0].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await db.account.update({
        where: { userId: actors[0].id },
        data: { status: "DEACTIVATED" },
      });
      await expect(moderation.reports(actors[0].clerkId)).rejects.toMatchObject(
        { status: 403 },
      );
      await db.account.update({
        where: { userId: actors[0].id },
        data: { status: "PENDING" },
      });
      await expect(moderation.reports(actors[0].clerkId)).rejects.toMatchObject(
        { status: 403 },
      );
    });
    it("commits one disposition and enforcement atomically under concurrent reviews", async () => {
      const { post, report } = await reportedPost();
      const outcomes = await Promise.allSettled(
        ["REMOVE_POST", "DISMISS"].map((action) =>
          moderation.review(actors[0].clerkId, report.id, {
            action,
            note: "Reviewed evidence",
          }),
        ),
      );
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const audit = await db.operatorAction.findUniqueOrThrow({
        where: { reportId: report.id },
      });
      expect(await db.post.findUnique({ where: { id: post.id } })).toEqual(
        audit.action === "REMOVE_POST"
          ? null
          : expect.objectContaining({ id: post.id }),
      );
      expect(
        await db.operatorAction.count({ where: { reportId: report.id } }),
      ).toBe(1);
      await expect(
        moderation.review(actors[1].clerkId, report.id, {
          action: "DISMISS",
          note: "Forged founder",
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("rolls back a mismatched action and denies expired report evidence", async () => {
      const { post, report } = await reportedPost();
      await expect(
        moderation.review(actors[0].clerkId, report.id, {
          action: "REMOVE_MESSAGE",
          note: "Wrong target",
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await db.operatorAction.count({ where: { reportId: report.id } }),
      ).toBe(0);
      expect(
        (await db.safetyReport.findUniqueOrThrow({ where: { id: report.id } }))
          .status,
      ).toBe("RECEIVED");
      now = new Date(post.expiresAt);
      expect(
        (await moderation.report(actors[0].clerkId, report.id)).target,
      ).toBeNull();
      await expect(
        moderation.review(actors[0].clerkId, report.id, {
          action: "REMOVE_POST",
          note: "Expired",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("limits photo evidence/removal to attachments of the report, denies bytes immediately and preserves daily usage", async () => {
      await friends();
      const bytes = await sharp({
        create: { width: 4, height: 4, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      const post = await service.createPhotoPost(
        actors[1].clerkId,
        bytes,
        "image/jpeg",
      );
      const photoId = post.photos[0].photo.id;
      const other = await service.uploadGallery(
        actors[1].clerkId,
        bytes,
        "image/jpeg",
      );
      const report = await service.createReport(actors[2].clerkId, {
        target: {
          kind: "post",
          id: post.id,
          personId: actors[1].id,
          label: "Photo",
        },
        reason: "privacy",
        details: "",
      });
      expect(
        (await moderation.reportPhoto(actors[0].clerkId, report.id, photoId))
          .length,
      ).toBeGreaterThan(0);
      await expect(
        moderation.reportPhoto(actors[0].clerkId, report.id, other.id),
      ).rejects.toMatchObject({ status: 404 });
      await moderation.review(actors[0].clerkId, report.id, {
        action: "REMOVE_PHOTO",
        photoId,
        note: "Privacy violation",
      });
      await expect(
        service.readPhoto(actors[2].clerkId, photoId),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photoId } }))
          .uploadedAt,
      ).not.toBeNull();
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      await service.updatePreferences(actors[1].clerkId, {
        postingTimeZone: "Asia/Tokyo",
      });
      await service.uploadGallery(actors[1].clerkId, bytes, "image/jpeg");
      await expect(
        service.uploadGallery(actors[1].clerkId, bytes, "image/jpeg"),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("prevents reporting an outgoing message as the recipient and removes a received reported message for both participants", async () => {
      await friends();
      const message = await service.sendMessage(
        actors[1].clerkId,
        actors[2].id,
        { body: "Reported message", requestId: randomUUID() },
      );
      await expect(
        service.createReport(actors[1].clerkId, {
          target: {
            kind: "message",
            id: message.id,
            personId: actors[2].id,
            label: "Message",
          },
          reason: "spam",
          details: "",
        }),
      ).rejects.toMatchObject({ status: 404 });
      const report = await service.createReport(actors[2].clerkId, {
        target: {
          kind: "message",
          id: message.id,
          personId: actors[1].id,
          label: "Message",
        },
        reason: "spam",
        details: "",
      });
      await moderation.review(actors[0].clerkId, report.id, {
        action: "REMOVE_MESSAGE",
        note: "Spam",
      });
      expect(
        (await service.conversation(actors[1].clerkId, actors[2].id)).messages,
      ).toHaveLength(0);
      expect(
        (await service.conversation(actors[2].clerkId, actors[1].id)).messages,
      ).toHaveLength(0);
    });
    it("deactivates a reported member without granting a founder self-deactivation path", async () => {
      const report = await service.createReport(actors[2].clerkId, {
        target: {
          kind: "profile",
          id: actors[1].id,
          personId: actors[1].id,
          label: "Profile",
        },
        reason: "harmful",
        details: "",
      });
      await moderation.review(actors[0].clerkId, report.id, {
        action: "DEACTIVATE_ACCOUNT",
        note: "Repeated abuse",
      });
      await expect(service.identity(actors[1].clerkId)).rejects.toMatchObject({
        status: 403,
      });
      const founderReport = await service.createReport(actors[2].clerkId, {
        target: {
          kind: "profile",
          id: actors[0].id,
          personId: actors[0].id,
          label: "Profile",
        },
        reason: "other",
        details: "",
      });
      await expect(
        moderation.review(actors[0].clerkId, founderReport.id, {
          action: "DEACTIVATE_ACCOUNT",
          note: "Do not lock out all operators",
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("never assigns public Event administrators by arrival, emptiness, inheritance or delegation", async () => {
      const joins = await Promise.all(
        actors
          .slice(1)
          .map((actor) =>
            service.joinTicketmasterEvent(actor.clerkId, calvinEvent.id),
          ),
      );
      const id = joins[0].id;
      expect(new Set(joins.map((row) => row.id)).size).toBe(1);
      expect(
        await db.spaceMembership.count({
          where: { spaceId: id, role: "ADMIN" },
        }),
      ).toBe(0);
      await expect(
        service.deleteSpace(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        moderation.assignEventAdmin(actors[1].clerkId, id, {
          userId: actors[1].id,
          role: "ADMIN",
          note: "Self grant",
        }),
      ).rejects.toMatchObject({ status: 403 });
      await moderation.assignEventAdmin(actors[0].clerkId, id, {
        userId: actors[1].id,
        role: "ADMIN",
        note: "Reviewed host",
      });
      await friends(1, 0);
      const invitation = await service.invite(
        actors[1].clerkId,
        id,
        actors[0].id,
      );
      await moderation.assignEventAdmin(actors[0].clerkId, id, {
        userId: actors[1].id,
        role: "MEMBER",
        note: "Host appointment revoked",
      });
      expect(
        await db.spaceInvitation.findUnique({ where: { id: invitation.id } }),
      ).toBeNull();
      await moderation.assignEventAdmin(actors[0].clerkId, id, {
        userId: actors[1].id,
        role: "ADMIN",
        note: "New appointment",
      });
      await expect(
        service.member(actors[1].clerkId, id, {
          action: "role",
          userId: actors[2].id,
          role: "ADMIN",
        }),
      ).rejects.toMatchObject({ status: 403 });
      await service.member(actors[1].clerkId, id, {
        action: "remove",
        userId: actors[1].id,
      });
      expect(
        await db.spaceMembership.count({
          where: { spaceId: id, role: "ADMIN" },
        }),
      ).toBe(0);
      await Promise.all(
        actors.slice(2).map((actor) =>
          service.member(actor.clerkId, id, {
            action: "remove",
            userId: actor.id,
          }),
        ),
      );
      await service.joinEvent(actors[1].clerkId, id);
      expect((await service.readSpace(actors[1].clerkId, id)).role).toBe(
        "MEMBER",
      );
    });
    it("preserves published usage through deletion, failed concurrent attempts and time-zone changes", async () => {
      const subject = actors[1].clerkId;
      for (let index = 0; index < 3; index++) {
        const post = await service.createPost(subject, "A thought");
        await service.deletePost(subject, post.id);
      }
      expect((await service.postingAllowance(subject)).regularRemaining).toBe(
        0,
      );
      await expect(
        service.createPost(subject, "One more"),
      ).rejects.toMatchObject({ status: 409 });
      await service.updatePreferences(subject, {
        postingTimeZone: "Asia/Tokyo",
      });
      await expect(
        service.createPost(subject, "No zone reset"),
      ).rejects.toMatchObject({ status: 409 });
      await service.updatePreferences(subject, {
        postingTimeZone: "Pacific/Honolulu",
      });
      expect((await service.postingAllowance(subject)).regularRemaining).toBe(
        0,
      );
      expect(
        await db.postingUsage.count({ where: { ownerId: actors[1].id } }),
      ).toBe(3);
      now = new Date(now.getTime() + 26 * 3_600_000);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          service.createPost(subject, "Concurrent"),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(3);
    });
    it("requires accepted friendship at invitation issuance and acceptance; duplicate delivery stays quiet", async () => {
      const room = await service.createSpace(actors[1].clerkId, {
        kind: "PRIVATE",
        name: "Private",
      });
      await expect(
        service.invite(actors[1].clerkId, room.id, actors[2].id),
      ).rejects.toMatchObject({ status: 403 });
      await friends();
      const invitation = await service.invite(
        actors[1].clerkId,
        room.id,
        actors[2].id,
      );
      await service.invite(actors[1].clerkId, room.id, actors[2].id);
      expect(
        await db.memberNotification.count({
          where: { recipientId: actors[2].id, kind: "space_invitation" },
        }),
      ).toBe(1);
      await service.relationship(actors[1].clerkId, actors[2].id, "remove");
      await expect(
        service.accept(actors[2].clerkId, invitation.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (
          await service.invitationCandidates(
            actors[1].clerkId,
            room.id,
            "Review",
          )
        ).members,
      ).toHaveLength(0);
    });
    it("does not reset a 25-hour posting day after a zone change", async () => {
      now = new Date("2026-11-01T07:30:00Z");
      for (let index = 0; index < 3; index++) {
        const post = await service.createPost(
          actors[1].clerkId,
          "Fall-back day",
        );
        await service.deletePost(actors[1].clerkId, post.id);
      }
      await service.updatePreferences(actors[1].clerkId, {
        postingTimeZone: "Asia/Tokyo",
      });
      now = new Date("2026-11-02T07:45:00Z");
      expect(
        (await service.postingAllowance(actors[1].clerkId)).regularRemaining,
      ).toBe(0);
      await service.updatePreferences(actors[1].clerkId, {
        postingTimeZone: "Pacific/Honolulu",
      });
      expect(
        (await service.postingAllowance(actors[1].clerkId)).regularRemaining,
      ).toBe(0);
    });
    it("returns only the intended introduction fields in discovery", async () => {
      const result = await service.contacts(actors[1].clerkId, "Review");
      const text = JSON.stringify(result);
      expect(text).not.toContain("Private biography canary");
      expect(text).not.toContain("clerkId");
      expect(text).not.toContain("email");
      expect(Object.keys(result.contacts[0]).sort()).toEqual([
        "friendsSince",
        "person",
        "relationship",
        "username",
      ]);
    });
    it("keeps original-day editing independent of a new zone and bounds publication-marker erasure", async () => {
      const subject = actors[1].clerkId;
      const post = await service.createPost(subject, "Original day");
      await service.updatePreferences(subject, {
        postingTimeZone: "Asia/Tokyo",
      });
      now = new Date(now.getTime() + 86_400_000);
      await service.editPersonalPost(subject, post.id, "Edited original day");
      expect(
        (
          await db.postingUsage.findUniqueOrThrow({
            where: { postId: post.id },
          })
        ).timeZone,
      ).toBe("America/Los_Angeles");
      expect(await service.erasePostingUsage()).toBe(0);
      now = new Date(now.getTime() + 36 * 86_400_000);
      expect(await service.erasePostingUsage(1)).toBe(1);
      expect(await service.erasePostingUsage(1)).toBe(0);
    });
    it("rolls back enforcement when writing the mandatory audit record fails", async () => {
      const { post, report } = await reportedPost();
      // A real unique-key conflict fails the mandatory audit insert after enforcement.
      await db.operatorAction.create({
        data: {
          operatorId: actors[0].id,
          reportId: report.id,
          action: "DISMISS",
          targetId: post.id,
          note: "Simulated conflicting audit",
        },
      });
      await expect(
        moderation.review(actors[0].clerkId, report.id, {
          action: "REMOVE_POST",
          note: "Cannot lose the audit trail",
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      expect(
        (await db.safetyReport.findUniqueOrThrow({ where: { id: report.id } }))
          .status,
      ).toBe("RECEIVED");
    });
  },
);
