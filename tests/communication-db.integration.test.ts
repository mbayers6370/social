// @vitest-environment node
// Real disposable PostgreSQL; controlled Clerk/session and Redis adapters.
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
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import { memberRequest } from "@/server/member/http";
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
  "messaging consent and Space activity",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let users: { id: string; clerkId: string }[];
    const now = new Date("2026-11-03T12:00:00Z");
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "55432" ||
        !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
        url.username !== "margin_runtime"
      )
        throw Error("Disposable runtime database required");
      db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 5) });
      service = new MemberService(
        db,
        { put: vi.fn(), get: vi.fn(), delete: vi.fn() },
        () => now,
      );
      vi.mocked(getDb).mockReturnValue(db);
    });
    beforeEach(async () => {
      users = [];
      for (let i = 0; i < 6; i++)
        users.push(
          await db.user.create({
            data: {
              clerkId: `consent-${randomUUID()}`,
              account: {
                create: {
                  status: i === 4 ? "PENDING" : "ACTIVE",
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
      session.subject = users[0].clerkId;
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    });
    afterEach(async () => {
      vi.unstubAllEnvs();
      await db.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    const message = (body = "A private hello") => ({
      body,
      requestId: randomUUID(),
    });
    async function room(kind: "PRIVATE" | "GATHERING" = "PRIVATE") {
      const space = await service.createSpace(
        users[0].clerkId,
        kind === "PRIVATE"
          ? { kind, name: "Our Space" }
          : {
              kind: "PRIVATE",
              name: "Dinner plans",
              startsAt: "2026-11-30T20:00:00Z",
              timeZone: "UTC",
              location: "Example place",
            },
      );
      await db.spaceMembership.createMany({
        data: [1, 2, 3, 4].map((i) => ({
          spaceId: space.id,
          userId: users[i].id,
        })),
      });
      return space;
    }
    it("defaults existing and new members to enabled and exposes the saved profile capability", async () => {
      expect(
        (await service.identity(users[0].clerkId)).preferences.messagingEnabled,
      ).toBe(true);
      expect(
        (await service.profile(users[0].clerkId, users[1].id)).profile
          .messagingEnabled,
      ).toBe(true);
      const next = await service.updatePreferences(users[1].clerkId, {
        messagingEnabled: false,
      });
      expect(next.preferences.messagingEnabled).toBe(false);
      expect(
        (await service.profile(users[0].clerkId, users[1].id)).profile
          .messagingEnabled,
      ).toBe(false);
    });
    it("blocks both directions, existing retries and Notebook while off, retaining history for re-enabling", async () => {
      const input = message();
      const saved = await service.sendMessage(
        users[0].clerkId,
        users[1].id,
        input,
      );
      const note = await service.sendMessage(
        users[1].clerkId,
        users[1].id,
        message("A note to keep"),
      );
      await service.updatePreferences(users[1].clerkId, {
        messagingEnabled: false,
      });
      await expect(
        service.sendMessage(users[0].clerkId, users[1].id, input),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.sendMessage(users[0].clerkId, users[1].id, message()),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.sendMessage(users[1].clerkId, users[0].id, message()),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.sendMessage(users[1].clerkId, users[1].id, message()),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        (await service.threads(users[0].clerkId)).threads.map((t) => t.id),
      ).not.toContain(users[1].id);
      await expect(service.threads(users[1].clerkId)).rejects.toMatchObject({
        status: 403,
      });
      for (const [actor, target, status] of [
        [0, 1, 404],
        [1, 0, 403],
      ] as const) {
        await expect(
          service.conversation(users[actor].clerkId, users[target].id),
        ).rejects.toMatchObject({ status });
        await expect(
          service.exportConversation(users[actor].clerkId, users[target].id),
        ).rejects.toMatchObject({ status });
        await expect(
          service.readConversation(
            users[actor].clerkId,
            users[target].id,
            saved.id,
          ),
        ).rejects.toMatchObject({ status });
        await expect(
          service.hideConversation(users[actor].clerkId, users[target].id),
        ).rejects.toMatchObject({ status });
      }
      expect(
        (await service.notifications(users[1].clerkId)).activity.filter(
          (a) => a.kind === "message",
        ),
      ).toEqual([]);
      expect(
        (await service.exportAccount(users[1].clerkId)).messages.map(
          (m) => m.id,
        ),
      ).toEqual(expect.arrayContaining([saved.id, note.id]));
      await service.updatePreferences(users[1].clerkId, {
        messagingEnabled: true,
      });
      expect(
        (
          await service.conversation(users[0].clerkId, users[1].id)
        ).messages.map((m) => m.id),
      ).toContain(saved.id);
      expect(
        (
          await service.conversation(users[1].clerkId, users[1].id)
        ).messages.map((m) => m.id),
      ).toContain(note.id);
      expect(
        (await service.threads(users[0].clerkId)).threads.map((t) => t.id),
      ).toContain(users[1].id);
      await expect(
        service.sendMessage(
          users[0].clerkId,
          users[1].id,
          message("Welcome back"),
        ),
      ).resolves.toHaveProperty("id");
    });
    it("keeps message notification preferences separate from permission to send and receive", async () => {
      await service.updatePreferences(users[1].clerkId, {
        notifyMessages: false,
      });
      await service.sendMessage(users[0].clerkId, users[1].id, message());
      expect(
        (await service.conversation(users[1].clerkId, users[0].id)).thread
          .canSend,
      ).toBe(true);
      expect(
        (await service.notifications(users[1].clerkId)).activity.filter(
          (a) => a.kind === "message",
        ),
      ).toEqual([]);
      await expect(
        service.sendMessage(users[2].clerkId, users[1].id, message()),
      ).rejects.toMatchObject({ status: 404 });
    });
    it.each([0, 1])(
      "does not deliver from a stale transaction after participant %i turns messaging off",
      async (disabled) => {
        const locked = Promise.withResolvers<void>(),
          release = Promise.withResolvers<void>();
        const off = db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${users[disabled].id} FOR UPDATE`;
          await tx.account.update({
            where: { userId: users[disabled].id },
            data: { messagingEnabled: false },
          });
          locked.resolve();
          await release.promise;
        });
        await locked.promise;
        const sending = service
          .sendMessage(users[0].clerkId, users[1].id, message())
          .then(
            () => "delivered",
            (error: { status: number }) => error.status,
          );
        await new Promise((resolve) => setTimeout(resolve, 30));
        release.resolve();
        await off;
        expect(await sending).toBe(disabled === 0 ? 403 : 404);
        expect(await db.memberMessage.count()).toBe(0);
      },
    );
    it("rejects direct messaging API paths while off and only updates the session's own setting", async () => {
      const call = (
        operation: Parameters<typeof memberRequest>[1],
        method = "GET",
        body?: object,
        target = users[1].id,
      ) =>
        memberRequest(
          new Request("http://localhost:3000/api/messages", {
            method,
            headers: {
              Origin: "http://localhost:3000",
              "Content-Type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
          operation,
          operation === "threads" || operation === "preferences"
            ? undefined
            : target,
        );
      expect(
        (await call("preferences", "PATCH", { messagingEnabled: false }))
          .status,
      ).toBe(200);
      for (const [operation, method, body] of [
        ["threads", "GET"],
        ["conversation", "GET"],
        ["conversationExport", "GET"],
        ["messageSend", "POST", message()],
        ["conversationRead", "PUT", {}],
        ["conversationHide", "DELETE"],
      ] as const)
        expect((await call(operation, method, body)).status).toBe(403);
      expect(
        (
          await call("preferences", "PATCH", {
            messagingEnabled: true,
            userId: users[1].id,
          })
        ).status,
      ).toBe(400);
      expect(
        (await service.identity(users[1].clerkId)).preferences.messagingEnabled,
      ).toBe(true);
    });
    it("notifies all other eligible Private Space members, regardless of friendship or messaging opt-out", async () => {
      const space = await room();
      await service.relationship(users[3].clerkId, users[0].id, "block");
      await service.updatePreferences(users[2].clerkId, {
        messagingEnabled: false,
      });
      const post = await service.publish(users[0].clerkId, space.id, {
        body: "Something for everyone here",
        photoIds: [],
      });
      const notices = await db.memberNotification.findMany({
        where: { kind: "space_post", postId: post.id },
      });
      expect(notices.map((n) => n.recipientId).sort()).toEqual(
        [users[1].id, users[2].id].sort(),
      );
      for (const i of [1, 2]) {
        const activity = (
          await service.notifications(users[i].clerkId)
        ).activity.filter((a) => a.kind === "space_post");
        expect(activity).toHaveLength(1);
        expect(activity[0]).toMatchObject({
          spaceName: "Our Space",
          read: false,
        });
        expect(activity[0].href).toBe(
          `/app/spaces/${space.id}?post=${post.id}#${post.id}`,
        );
      }
      await service.editPersonalPost(users[0].clerkId, post.id, "An edit");
      expect(
        await db.memberNotification.count({
          where: { kind: "space_post", postId: post.id },
        }),
      ).toBe(2);
    });
    it("publishes Gathering Space upload notifications atomically with a successful post", async () => {
      const space = await room("GATHERING");
      const bytes = await sharp({
        create: { width: 120, height: 80, channels: 3, background: "#454d24" },
      })
        .jpeg()
        .toBuffer();
      const post = await service.publishWithUploads(
        users[0].clerkId,
        space.id,
        { body: "See you there", photoIds: [] },
        [{ bytes, type: "image/jpeg", description: "An example photograph" }],
      );
      expect(
        await db.memberNotification.count({
          where: { kind: "space_post", postId: post.id },
        }),
      ).toBe(3);
      const before = await db.memberNotification.count({
        where: { kind: "space_post" },
      });
      await expect(
        service.publish(users[5].clerkId, space.id, {
          body: "Not a member",
          photoIds: [],
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await db.memberNotification.count({ where: { kind: "space_post" } }),
      ).toBe(before);
    });
    it("also notifies for the single-photo publishing path and never announces a failed upload", async () => {
      const space = await room();
      const bytes = await sharp({
        create: { width: 120, height: 80, channels: 3, background: "#454d24" },
      })
        .jpeg()
        .toBuffer();
      const post = await service.createPhotoPost(
        users[0].clerkId,
        bytes,
        "image/jpeg",
        "A shared photograph",
        space.id,
      );
      expect(
        await db.memberNotification.count({
          where: { kind: "space_post", postId: post.id },
        }),
      ).toBe(3);
      await expect(
        service.createPhotoPost(
          users[0].clerkId,
          new Uint8Array([1, 2, 3]),
          "image/jpeg",
          "Invalid image",
          space.id,
        ),
      ).rejects.toThrow();
      expect(await db.post.count({ where: { spaceId: space.id } })).toBe(1);
      expect(
        await db.memberNotification.count({ where: { kind: "space_post" } }),
      ).toBe(3);
    });
    it("does not emit post notifications for Event Spaces or personal posts", async () => {
      const start = new Date(now.getTime() + 3600000),
        end = new Date(start.getTime() + 4 * 3600000);
      const space = await db.space.create({
        data: {
          kind: "EVENT",
          name: "Fictional concert",
          creatorId: users[0].id,
          startsAt: start,
          endsAt: end,
          expiresAt: new Date(end.getTime() + 48 * 3600000),
          timeZone: "UTC",
          ticketmasterId: `fixture-${randomUUID()}`,
          memberships: {
            create: [0, 1].map((i) => ({
              userId: users[i].id,
              role: i === 0 ? "ADMIN" : "MEMBER",
            })),
          },
        },
      });
      await service.publish(users[0].clerkId, space.id, {
        body: "An event post",
        photoIds: [],
      });
      await service.publishPersonal(users[0].clerkId, {
        body: "A personal post",
        photoIds: [],
      });
      expect(
        await db.memberNotification.count({ where: { kind: "space_post" } }),
      ).toBe(0);
    });
    it("removes Space activity from reads after leaving, blocking, post deletion or expiry", async () => {
      const space = await room();
      const post = await service.publish(users[0].clerkId, space.id, {
        body: "Space update",
        photoIds: [],
      });
      await service.member(users[1].clerkId, space.id, {
        action: "remove",
        userId: users[1].id,
      });
      expect(
        (await service.notifications(users[1].clerkId)).activity.filter(
          (a) => a.kind === "space_post",
        ),
      ).toEqual([]);
      await service.relationship(users[2].clerkId, users[0].id, "block");
      expect(
        (await service.notifications(users[2].clerkId)).activity.filter(
          (a) => a.kind === "space_post",
        ),
      ).toEqual([]);
      await db.post.update({
        where: { id: post.id },
        data: { createdAt: new Date(now.getTime() - 86400000), expiresAt: now },
      });
      expect(
        (await service.notifications(users[3].clerkId)).activity.filter(
          (a) => a.kind === "space_post",
        ),
      ).toEqual([]);
      await service.deletePost(users[0].clerkId, post.id);
      expect(
        (await service.notifications(users[3].clerkId)).activity.filter(
          (a) => a.kind === "space_post",
        ),
      ).toEqual([]);
    });
    it("delivers across multiple bounded batches without omissions or duplicate recipients", async () => {
      const space = await room();
      const batch = Array.from({ length: 205 }, () => ({
        id: `fan_${randomUUID()}`,
        clerkId: `batch-${randomUUID()}`,
      }));
      users.push(...batch);
      await db.user.createMany({ data: batch });
      await db.account.createMany({
        data: batch.map((u) => ({
          userId: u.id,
          status: "ACTIVE",
          displayName: "Batch member",
        })),
      });
      await db.spaceMembership.createMany({
        data: batch.map((u) => ({ spaceId: space.id, userId: u.id })),
      });
      const post = await service.publish(users[0].clerkId, space.id, {
        body: "For the whole Space",
        photoIds: [],
      });
      const rows = await db.memberNotification.findMany({
        where: { postId: post.id, kind: "space_post" },
        select: { recipientId: true },
      });
      expect(rows).toHaveLength(208);
      expect(new Set(rows.map((row) => row.recipientId)).size).toBe(208);
    });
  },
);
