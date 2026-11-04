// @vitest-environment node
import { privateTestDatabaseUrl } from "./helpers/database";
// Actual disposable PostgreSQL; object storage and Clerk are controlled doubles.
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
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import {
  maintenanceHealth,
  runLeasedJob,
  runMaintenanceCycle,
} from "@/server/jobs/maintenance";
import { reconcilePhotoObjects } from "@/server/jobs/photo-orphans";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "scheduled retention with real PostgreSQL",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let users: { id: string; clerkId: string }[];
    let now: Date;
    const bytes = new Map<string, Uint8Array>();
    const store = {
      list: vi.fn(async (after?: string, limit = 100) => {
        const keys = [...bytes.keys()]
          .filter((key) => key.startsWith("social/") && (!after || key > after))
          .sort();
        return {
          objects: keys.slice(0, limit).map((key) => ({
            key,
            lastModified: new Date(now.getTime() - 600_000),
          })),
          hasMore: keys.length > limit,
        };
      }),
      put: vi.fn(async (key: string, data: Uint8Array) => {
        bytes.set(key, data);
      }),
      get: vi.fn(async (key: string) => bytes.get(key)!),
      delete: vi.fn(async (key: string) => {
        bytes.delete(key);
      }),
    };
    beforeAll(() => {
      const url = privateTestDatabaseUrl();
      db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 8) });
    });
    beforeEach(async () => {
      now = new Date("2026-11-03T12:00:00Z");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      bytes.clear();
      users = [];
      for (let i = 0; i < 2; i++)
        users.push(
          await db.user.create({
            data: {
              clerkId: `retention-${randomUUID()}`,
              account: {
                create: { status: "ACTIVE", displayName: "Example member" },
              },
            },
            select: { id: true, clerkId: true },
          }),
        );
      service = new MemberService(db, store, () => now);
      await service.relationship(users[0].clerkId, users[1].id, "request");
      await service.relationship(users[1].clerkId, users[0].id, "accept");
    });
    afterEach(async () => {
      await db.invitation.deleteMany({
        where: { createdBy: { in: users.map((u) => u.id) } },
      });
      await db.invitationLink.deleteMany({
        where: { createdBy: { in: users.map((u) => u.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
      await db.maintenanceJob.deleteMany();
      vi.useRealTimers();
    });
    afterAll(async () => db?.$disconnect());
    async function message(ageDays: number, notebook = false, offset = 0) {
      const row = await db.memberMessage.create({
        data: {
          senderId: users[0].id,
          recipientId: notebook ? users[0].id : users[1].id,
          requestId: randomUUID(),
          body: "Retention canary",
          createdAt: new Date(now.getTime() - ageDays * 86_400_000 + offset),
        },
      });
      if (!notebook)
        await db.memberNotification.create({
          data: {
            actorId: users[0].id,
            recipientId: users[1].id,
            kind: "message",
            dedupeKey: `message:${row.id}`,
            createdAt: row.createdAt,
          },
        });
      return row;
    }
    it("enforces exact 30/90-day read and export boundaries before cleanup, then erases rows and notifications", async () => {
      const expired = await message(30);
      const live = await message(30, false, 1);
      const expiredNote = await message(90, true);
      const liveNote = await message(90, true, 1);
      expect(
        (
          await service.conversation(users[1].clerkId, users[0].id)
        ).messages.map((m) => m.id),
      ).toEqual([live.id]);
      expect(
        (
          await service.conversation(users[0].clerkId, users[0].id)
        ).messages.map((m) => m.id),
      ).toEqual([liveNote.id]);
      expect(
        (
          await service.exportConversation(users[1].clerkId, users[0].id)
        ).messages.map((m) => m.id),
      ).toEqual([live.id]);
      const exported = await service.exportAccount(users[0].clerkId);
      expect(exported.messages.map((m) => m.id).sort()).toEqual(
        [live.id, liveNote.id].sort(),
      );
      expect(
        (await service.notifications(users[1].clerkId)).activity.filter(
          (n) => n.kind === "message",
        ),
      ).toHaveLength(1);
      expect(await db.memberMessage.count()).toBe(4);
      expect((await service.expireMessages(1)).messages).toBe(1);
      expect((await service.expireMessages(1)).messages).toBe(1);
      expect((await service.expireMessages(1)).messages).toBe(0);
      expect(
        await db.memberMessage.findUnique({ where: { id: expired.id } }),
      ).toBeNull();
      expect(
        await db.memberMessage.findUnique({ where: { id: expiredNote.id } }),
      ).toBeNull();
      expect(
        await db.memberNotification.findUnique({
          where: { dedupeKey: `message:${expired.id}` },
        }),
      ).toBeNull();
    });
    it("hard-deletes expired and legacy deleted posts with all dependent discussion, likes and activity", async () => {
      const post = await service.createPost(
        users[0].clerkId,
        "Erase this text completely",
      );
      await service.comment(users[1].clerkId, post.id, {
        body: "Erase this comment too",
      });
      await service.like(users[1].clerkId, post.id, true);
      await db.post.update({
        where: { id: post.id },
        data: { expiresAt: new Date(now.getTime() + 1) },
      });
      now = new Date(now.getTime() + 1);
      expect(await service.expirePosts()).toBe(1);
      expect(await service.expirePosts()).toBe(0);
      expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull();
      expect(await db.postComment.count({ where: { postId: post.id } })).toBe(
        0,
      );
      expect(await db.postLike.count({ where: { postId: post.id } })).toBe(0);
      expect(
        await db.memberNotification.count({ where: { postId: post.id } }),
      ).toBe(0);
      const legacy = await service.createPost(
        users[0].clerkId,
        "Old tombstone",
      );
      await db.post.update({
        where: { id: legacy.id },
        data: { deletedAt: now },
      });
      expect(await service.expirePosts()).toBe(1);
      expect(await db.post.findUnique({ where: { id: legacy.id } })).toBeNull();
    });
    it("reuses one canonical photo in two Spaces and Gallery, deleting its original only after the last reference", async () => {
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      const personal = await service.createPhotoPost(
        users[0].clerkId,
        image,
        "image/jpeg",
        "One original",
      );
      const photoId = personal.photos[0].photo.id;
      const first = await service.createSpace(users[0].clerkId, {
        kind: "PRIVATE",
        name: "First",
      });
      const second = await service.createSpace(users[0].clerkId, {
        kind: "PRIVATE",
        name: "Second",
      });
      await service.publish(users[0].clerkId, first.id, {
        body: "First use",
        photoIds: [photoId],
      });
      await service.publish(users[0].clerkId, second.id, {
        body: "Second use",
        photoIds: [photoId],
      });
      expect(await db.photo.count({ where: { ownerId: users[0].id } })).toBe(1);
      expect(bytes.size).toBe(1);
      expect(await db.postPhoto.count({ where: { photoId } })).toBe(3);
      await service.deletePost(users[0].clerkId, personal.id);
      await service.deleteSpace(users[0].clerkId, first.id);
      expect(await service.purgeDeletedPhotos()).toBe(0);
      expect(bytes.size).toBe(1);
      await db.galleryEntry.deleteMany({ where: { photoId } });
      await service.deleteSpace(users[0].clerkId, second.id);
      store.delete.mockRejectedValueOnce(Error("private provider details"));
      await expect(service.purgeDeletedPhotos()).rejects.toThrow();
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photoId } })).state,
      ).toBe("DELETE_PENDING");
      expect(await service.purgeDeletedPhotos()).toBe(1);
      expect(bytes.size).toBe(0);
      expect(
        await db.photo.findUnique({ where: { id: photoId } }),
      ).toMatchObject({
        state: "PURGED",
        description: "",
        objectKey: `purged/${photoId}`,
      });
      expect(await service.erasePurgedPhotoRecords()).toBe(0);
      now = new Date(now.getTime() + 86_400_000);
      expect(await service.erasePurgedPhotoRecords()).toBe(1);
      expect(await db.photo.findUnique({ where: { id: photoId } })).toBeNull();
    });
    it("continues purging other photos after one storage failure and retries the failed key", async () => {
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      for (let i = 0; i < 2; i++) {
        const post = await service.createPhotoPost(
          users[0].clerkId,
          image,
          "image/jpeg",
          "Delete original",
        );
        const id = post.photos[0].photo.id;
        await db.galleryEntry.deleteMany({ where: { photoId: id } });
        await service.deletePost(users[0].clerkId, post.id);
      }
      store.delete.mockRejectedValueOnce(
        Error("Storage unavailable for one key"),
      );
      await expect(service.purgeDeletedPhotos()).rejects.toThrow();
      expect(bytes.size).toBe(1);
      expect(await db.photo.count({ where: { state: "DELETE_PENDING" } })).toBe(
        1,
      );
      expect(await db.photo.count({ where: { state: "PURGED" } })).toBe(1);
      expect(await service.purgeDeletedPhotos()).toBe(1);
      expect(bytes.size).toBe(0);
    });
    it("rechecks a stale post-expiry scan before erasing a still-live post", async () => {
      const post = await service.createPost(users[0].clerkId, "Still live");
      const record = await db.post.findUniqueOrThrow({
        where: { id: post.id },
      });
      const scan = vi
        .spyOn(db.post, "findMany")
        .mockResolvedValueOnce([record]);
      try {
        expect(await service.expirePosts()).toBe(0);
        expect(
          await db.post.findUnique({ where: { id: post.id } }),
        ).toMatchObject({ body: "Still live" });
      } finally {
        scan.mockRestore();
      }
    });
    it("requeues a late object write after its upload reservation has already been erased", async () => {
      store.put.mockImplementationOnce(async (key, data) => {
        await db.photo.deleteMany({ where: { objectKey: key } });
        bytes.set(key, data);
      });
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      await expect(
        service.createPhotoPost(
          users[0].clerkId,
          image,
          "image/jpeg",
          "Do not retain",
        ),
      ).rejects.toThrow();
      expect(bytes.size).toBe(1);
      expect(await service.purgeDeletedPhotos()).toBe(1);
      expect(await service.erasePurgedPhotoRecords()).toBe(1);
      expect(bytes.size).toBe(0);
      expect(await db.photo.count({ where: { ownerId: users[0].id } })).toBe(0);
    });
    it("sweeps untracked objects after uploader crashes, preserving active assets, recent writes and other namespaces", async () => {
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      const post = await service.createPhotoPost(
        users[0].clerkId,
        image,
        "image/jpeg",
        "Keep this original",
      );
      const asset = await db.photo.findUniqueOrThrow({
        where: { id: post.photos[0].photo.id },
      });
      const orphan = `social/${randomUUID()}.webp`;
      const recent = `social/${randomUUID()}.webp`;
      const foreign = "another-namespace/private.webp";
      for (const key of [orphan, recent, foreign])
        bytes.set(key, new Uint8Array([1]));
      store.list.mockResolvedValueOnce({
        objects: [...bytes.keys()].sort().map((key) => ({
          key,
          lastModified:
            key === recent ? now : new Date(now.getTime() - 600_001),
        })),
        hasMore: false,
      });
      const result = await runLeasedJob(db, "photos", (signal, owner) =>
        reconcilePhotoObjects(db, store, signal, owner),
      );
      expect(result).toMatchObject({
        status: "completed",
        counts: { orphaned: 1 },
      });
      expect(bytes.has(orphan)).toBe(false);
      expect(bytes.has(recent)).toBe(true);
      expect(bytes.has(foreign)).toBe(true);
      expect(bytes.has(asset.objectKey)).toBe(true);
      expect(
        (await maintenanceHealth(db)).find((job) => job.name === "photos"),
      ).not.toHaveProperty("objectCursor");
    });
    it("still sweeps crash-orphaned bytes when a tracked deletion fails", async () => {
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "olive" },
      })
        .jpeg()
        .toBuffer();
      const post = await service.createPhotoPost(
        users[0].clerkId,
        image,
        "image/jpeg",
        "Retry this deletion",
      );
      const id = post.photos[0].photo.id;
      await db.galleryEntry.deleteMany({ where: { photoId: id } });
      await service.deletePost(users[0].clerkId, post.id);
      const orphan = `social/${randomUUID()}.webp`;
      bytes.set(orphan, new Uint8Array([1]));
      store.delete.mockRejectedValueOnce(Error("One tracked key failed"));
      const result = await runMaintenanceCycle(db, store, {
        find: vi.fn().mockResolvedValue([]),
        revoke: vi.fn(),
      });
      expect(result.find((job) => job.name === "photos")?.status).toBe(
        "failed",
      );
      expect(bytes.has(orphan)).toBe(false);
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "DELETE_PENDING",
      );
    });
    it("persists object-scan progress when a batch is interrupted and wraps after finishing", async () => {
      for (let i = 1; i <= 3; i++)
        bytes.set(
          `social/00000000-0000-0000-0000-${String(i).padStart(12, "0")}.webp`,
          new Uint8Array([1]),
        );
      await db.maintenanceJob.create({
        data: { name: "photos", leaseOwner: "fixture" },
      });
      const controller = new AbortController();
      store.delete.mockImplementationOnce(async (key) => {
        bytes.delete(key);
        controller.abort();
      });
      expect(
        await reconcilePhotoObjects(db, store, controller.signal, "fixture"),
      ).toMatchObject({ examined: 1, orphaned: 1, scanComplete: 0 });
      expect(
        (
          await db.maintenanceJob.findUniqueOrThrow({
            where: { name: "photos" },
          })
        ).objectCursor,
      ).not.toBeNull();
      expect(
        await reconcilePhotoObjects(
          db,
          store,
          new AbortController().signal,
          "fixture",
        ),
      ).toMatchObject({ examined: 2, orphaned: 2, scanComplete: 1 });
      expect(bytes.size).toBe(0);
      expect(
        (
          await db.maintenanceJob.findUniqueOrThrow({
            where: { name: "photos" },
          })
        ).objectCursor,
      ).toBeNull();
    });
    it("leases prevent overlapping workers, recover abandoned leases and record sanitized failure and stale health", async () => {
      let release!: () => void;
      let started!: () => void;
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const first = runLeasedJob(
        db,
        "posts",
        async () => {
          started();
          await wait;
          return { erased: 1 };
        },
        now,
      );
      await ready;
      const duplicate = vi.fn(async () => ({ erased: 0 }));
      expect(await runLeasedJob(db, "posts", duplicate, now)).toMatchObject({
        status: "busy",
      });
      expect(duplicate).not.toHaveBeenCalled();
      release();
      expect(await first).toMatchObject({ status: "completed" });
      expect(
        await runLeasedJob(
          db,
          "posts",
          async () => {
            throw Error("PRIVATE-CONTENT-SECRET");
          },
          now,
        ),
      ).toMatchObject({ status: "failed" });
      expect(JSON.stringify(await db.maintenanceJob.findMany())).not.toContain(
        "PRIVATE-CONTENT-SECRET",
      );
      await db.maintenanceJob.update({
        where: { name: "posts" },
        data: {
          leaseOwner: "dead-worker",
          leaseUntil: new Date(now.getTime() - 1),
        },
      });
      expect(await runLeasedJob(db, "posts", duplicate, now)).toMatchObject({
        status: "completed",
      });
      expect(
        (await maintenanceHealth(db, new Date(now.getTime() + 180_000))).find(
          (job) => job.name === "posts",
        )?.healthy,
      ).toBe(false);
    });
    it("runs the actual credential-free CLI against the disposable database and exposes aggregate health", async () => {
      const args = [
        "--import",
        resolve("scripts/register-typescript.mjs"),
        "--conditions=react-server",
        "--experimental-transform-types",
        resolve("scripts/maintenance.mjs"),
      ];
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        MARGIN_MAINTENANCE_ENABLED: "1",
        CLERK_SECRET_KEY: "",
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET: "",
        NODE_ENV: "development",
        MARGIN_LOCAL_PHOTO_STORE: "1",
      };
      const cwd = mkdtempSync(join(tmpdir(), "margin-maintenance-cli-"));
      try {
        const run = spawnSync(process.execPath, [...args, "run"], {
          env,
          encoding: "utf8",
          timeout: 20_000,
          cwd,
        });
        expect(run.status, run.stderr).toBe(0);
        const logs = run.stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(logs).toHaveLength(5);
        expect(logs.every((job) => job.status === "completed")).toBe(true);
        const status = spawnSync(process.execPath, [...args, "status"], {
          env,
          encoding: "utf8",
          timeout: 20_000,
          cwd,
        });
        expect(status.status, status.stderr).toBe(0);
        expect(
          JSON.parse(status.stdout).every(
            (job: { healthy: boolean }) => job.healthy,
          ),
        ).toBe(true);
        expect(run.stdout).not.toContain(users[0].id);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
    it("continues content erasure when Clerk is unavailable and records the failed reconciliation for retry", async () => {
      await message(31);
      const link = await db.invitationLink.create({
        data: {
          createdBy: users[0].id,
          digest: randomUUID(),
          requestId: randomUUID(),
          createdAt: new Date(now.getTime() - 31 * 86_400_000),
          expiresAt: new Date(now.getTime() - 86_400_000),
        },
      });
      await db.invitation.create({
        data: {
          createdBy: users[0].id,
          digest: randomUUID(),
          email: "fixture@example.test",
          linkId: link.id,
          expiresAt: link.expiresAt,
          clerkInvitationId: "provider-fixture",
        },
      });
      const result = await runMaintenanceCycle(db, store, {
        find: vi.fn().mockRejectedValue(Error("PRIVATE-PROVIDER-SECRET")),
        revoke: vi.fn(),
      });
      expect(result.find((job) => job.name === "invitations")?.status).toBe(
        "failed",
      );
      expect(result.find((job) => job.name === "messages")?.status).toBe(
        "completed",
      );
      expect(await db.memberMessage.count()).toBe(0);
      expect(
        (
          await db.maintenanceJob.findUniqueOrThrow({
            where: { name: "invitations" },
          })
        ).failures,
      ).toBe(1);
    });
  },
);
