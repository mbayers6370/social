// @vitest-environment node
import { privateTestDatabaseUrl } from "./helpers/database";
// Disposable PostgreSQL. Clerk and Redis adapters are controlled doubles.
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
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import { socialRequest } from "@/server/social/http";
import { getDb } from "@/server/db";
const session = vi.hoisted(() => ({ subject: "" }));
vi.mock("@/server/auth", () => ({
  requireViewer: async () => ({ id: session.subject }),
  UnauthorizedError: class extends Error {},
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(),
}));

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "notification conversation destinations",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let users: { id: string; clerkId: string }[];
    let personal: { id: string };
    let space: { id: string };
    let spacePost: { id: string };
    const now = new Date("2026-11-03T12:00:00Z");
    beforeAll(() => {
      const url = privateTestDatabaseUrl();
      db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 3) });
      service = new MemberService(
        db,
        { put: vi.fn(), get: vi.fn(), delete: vi.fn() },
        () => now,
      );
      vi.mocked(getDb).mockReturnValue(db);
    });
    beforeEach(async () => {
      users = [];
      for (let i = 0; i < 3; i++)
        users.push(
          await db.user.create({
            data: {
              clerkId: `notification-links-${randomUUID()}`,
              account: {
                create: {
                  status: "ACTIVE",
                  displayName: `Example ${i}`,
                  username: `u_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
                },
              },
            },
            select: { id: true, clerkId: true },
          }),
        );
      await service.relationship(users[0].clerkId, users[1].id, "request");
      await service.relationship(users[1].clerkId, users[0].id, "accept");
      personal = await makePost();
      space = await service.createSpace(users[0].clerkId, {
        kind: "PRIVATE",
        name: "Private example",
      });
      const invitation = await service.invite(
        users[0].clerkId,
        space.id,
        users[1].id,
      );
      await service.accept(users[1].clerkId, invitation.id);
      spacePost = await makePost(space.id);
      session.subject = users[0].clerkId;
      process.env.MARGIN_PRIVATE_BACKEND_ENABLED = "1";
    });
    afterEach(async () => {
      delete process.env.MARGIN_PRIVATE_BACKEND_ENABLED;
      await db.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function makePost(spaceId?: string, createdAt = now) {
      return db.post.create({
        data: {
          ownerId: users[0].id,
          body: "A private thought",
          hasLink: false,
          dayKey: "2026-11-03",
          createdAt,
          expiresAt: new Date(now.getTime() + 86400000),
          ...(spaceId ? { spaceId } : {}),
        },
        select: { id: true },
      });
    }
    async function thread(postId = personal.id) {
      const parent = await service.comment(users[0].clerkId, postId, {
        body: "An earlier thought",
      });
      const reply = await service.comment(users[1].clerkId, postId, {
        body: "A reply to find",
        replyTo: parent.id,
      });
      return { parent, reply };
    }
    it("emits exact personal and Space comment URLs without exposing a foreign post", async () => {
      const a = await thread();
      const b = await thread(spacePost.id);
      const { activity } = await service.notifications(users[0].clerkId);
      const first = activity.find(
        (r) => r.kind === "comment" && r.href.includes(a.reply.id),
      )!;
      const second = activity.find(
        (r) => r.kind === "comment" && r.href.includes(b.reply.id),
      )!;
      const url = new URL(first.href, "http://localhost");
      expect(url.searchParams.get("person")).toBe(users[0].id);
      expect(url.searchParams.get("post")).toBe(personal.id);
      expect(url.searchParams.get("comment")).toBe(a.reply.id);
      expect(second.href).toBe(
        `/app/spaces/${space.id}?post=${spacePost.id}&comment=${b.reply.id}#${spacePost.id}`,
      );
      await expect(
        service.comments(users[0].clerkId, personal.id, undefined, b.reply.id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("links replies to another member's comment to the reply itself", async () => {
      const parent = await service.comment(users[1].clerkId, personal.id, {
        body: "A friend's thought",
      });
      const reply = await service.comment(users[0].clerkId, personal.id, {
        body: "Reply by owner",
        replyTo: parent.id,
      });
      const rows = (await service.notifications(users[1].clerkId)).activity;
      expect(rows.find((r) => r.kind === "reply")?.href).toContain(
        `comment=${reply.id}`,
      );
    });
    it("loads a bounded target and parent outside the first comment page while keeping the normal older cursor", async () => {
      const { parent, reply } = await thread();
      await db.postComment.updateMany({
        where: { id: { in: [parent.id, reply.id] } },
        data: { createdAt: new Date(now.getTime() - 50000) },
      });
      for (let i = 0; i < 25; i++)
        await db.postComment.create({
          data: {
            postId: personal.id,
            authorId: users[0].id,
            body: `Recent ${i}`,
            createdAt: new Date(now.getTime() - i * 1000),
          },
        });
      const ordinary = await service.comments(users[0].clerkId, personal.id);
      expect(ordinary.comments.some((c) => c.id === reply.id)).toBe(false);
      const target = await service.comments(
        users[0].clerkId,
        personal.id,
        undefined,
        reply.id,
      );
      expect(target.comments).toHaveLength(22);
      expect(target.comments.map((c) => c.id)).toContain(parent.id);
      expect(target.comments.find((c) => c.id === reply.id)?.replyTo).toBe(
        parent.id,
      );
      expect(target.nextCursor).toBe(ordinary.nextCursor);
      const older = await service.comments(
        users[0].clerkId,
        personal.id,
        target.nextCursor!,
        reply.id,
      );
      expect(older.comments.map((c) => c.body)).toEqual(
        expect.arrayContaining(["Recent 24", "A reply to find"]),
      );
    });
    it("loads older personal and Space posts inclusively without changing the owner or membership scope", async () => {
      const old = new Date(now.getTime() - 60000);
      await db.post.updateMany({
        where: { id: { in: [personal.id, spacePost.id] } },
        data: { createdAt: old },
      });
      for (let i = 0; i < 22; i++) {
        await makePost(undefined, new Date(now.getTime() - i));
        await makePost(space.id, new Date(now.getTime() - i));
      }
      expect(
        (await service.profile(users[1].clerkId, users[0].id)).posts.map(
          (p) => p.id,
        ),
      ).not.toContain(personal.id);
      expect(
        (
          await service.profile(
            users[1].clerkId,
            users[0].id,
            undefined,
            personal.id,
          )
        ).posts[0].id,
      ).toBe(personal.id);
      expect(
        (
          await service.posts(
            users[1].clerkId,
            space.id,
            undefined,
            spacePost.id,
          )
        ).posts[0].id,
      ).toBe(spacePost.id);
      await expect(
        service.profile(users[1].clerkId, users[0].id, undefined, spacePost.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.posts(users[1].clerkId, space.id, undefined, personal.id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("denies target reads after blocking, expiry or leaving a Space", async () => {
      const { reply } = await thread();
      const spaceThread = await thread(spacePost.id);
      await expect(
        service.comments(users[2].clerkId, personal.id, undefined, reply.id),
      ).rejects.toMatchObject({ status: 404 });
      await service.member(users[1].clerkId, space.id, {
        action: "remove",
        userId: users[1].id,
      });
      await expect(
        service.comments(
          users[1].clerkId,
          spacePost.id,
          undefined,
          spaceThread.reply.id,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await service.relationship(users[0].clerkId, users[1].id, "block");
      await expect(
        service.comments(users[0].clerkId, personal.id, undefined, reply.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.profile(users[1].clerkId, users[0].id, undefined, personal.id),
      ).rejects.toMatchObject({ status: 404 });
      await db.post.update({
        where: { id: personal.id },
        data: { createdAt: new Date(now.getTime() - 86400000), expiresAt: now },
      });
      await expect(
        service.comments(users[0].clerkId, personal.id, undefined, reply.id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("omits deleted or deactivated comment notifications", async () => {
      const { reply } = await thread();
      await db.postComment.delete({ where: { id: reply.id } });
      expect(
        (await service.notifications(users[0].clerkId)).activity.filter(
          (r) => r.kind === "comment",
        ),
      ).toEqual([]);
      await thread();
      await db.account.update({
        where: { userId: users[1].id },
        data: { status: "DEACTIVATED" },
      });
      expect(
        (await service.notifications(users[0].clerkId)).activity.filter(
          (r) => r.kind === "comment",
        ),
      ).toEqual([]);
    });
    it("validates exact target query parameters at the authenticated HTTP boundary", async () => {
      const { reply } = await thread();
      const read = (query: string) =>
        socialRequest(
          new Request(
            `http://localhost/api/posts/${personal.id}/comments?${query}`,
          ),
          "commentsRead",
          personal.id,
        );
      const result = await read(`comment=${reply.id}`);
      expect(result.status).toBe(200);
      expect(
        (await result.json()).comments.some(
          (c: { id: string }) => c.id === reply.id,
        ),
      ).toBe(true);
      expect(result.headers.get("cache-control")).toContain("no-store");
      expect((await read("comment=bad%2Fid")).status).toBe(400);
      expect(
        (await read(`comment=${reply.id}&comment=${reply.id}`)).status,
      ).toBe(400);
      expect((await read(`comment=${reply.id}&unexpected=1`)).status).toBe(400);
      session.subject = users[2].clerkId;
      expect((await read(`comment=${reply.id}`)).status).toBe(404);
    });
  },
);
