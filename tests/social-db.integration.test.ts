// @vitest-environment node
// Real disposable PostgreSQL + real image decoder/private filesystem bytes.
// Clerk sessions and Redis are mocked: this does not verify hosted identity/rate limits/R2.
import {
  afterAll,
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { SocialService } from "@/server/social/service";
import { normalizePhoto, type PrivatePhotoStore } from "@/server/social/photo";
import { getDb } from "@/server/db";
import { privatePhotoStore } from "@/server/social/photo";
import { socialRequest } from "@/server/social/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
const session = vi.hoisted(() => ({ subject: "" }));
vi.mock("@/server/auth", () => ({
  requireViewer: async () => ({ id: session.subject }),
  UnauthorizedError: class extends Error {},
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(async () => undefined),
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));

const enabled = process.env.RUN_PRIVATE_DB_TESTS === "1";
describe.skipIf(!enabled)(
  "private backend: actual PostgreSQL authorization and lifecycle",
  () => {
    let db: PrismaClient;
    let directory: string;
    let store: PrivatePhotoStore;
    let service: SocialService;
    let photo: Buffer;
    let actors: { id: string; clerkId: string }[];
    let now = new Date("2026-10-29T17:00:00Z");
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "55432" ||
        !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
        url.username !== "margin_runtime"
      )
        throw new Error("Refusing non-disposable database");
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.href, max: 10 }),
      });
      directory = await mkdtemp(join(tmpdir(), "margin-private-photo-test-"));
      store = {
        put: vi.fn(async (key, bytes) => {
          await writeFile(join(directory, key.split("/").at(-1)!), bytes);
        }),
        get: vi.fn(
          async (key) =>
            new Uint8Array(
              await readFile(join(directory, key.split("/").at(-1)!)),
            ),
        ),
        delete: vi.fn(async (key) => {
          await rm(join(directory, key.split("/").at(-1)!), { force: true });
        }),
      };
      photo = await sharp({
        create: { width: 4, height: 3, channels: 3, background: "red" },
      })
        .jpeg()
        .withExif({ IFD0: { Artist: "PRIVATE_METADATA_CANARY" } })
        .toBuffer();
    });
    beforeEach(async () => {
      now = new Date("2026-10-29T17:00:00Z");
      actors = await Promise.all(
        ["alice", "bob", "eve"].map((name) =>
          db.user.create({
            data: {
              clerkId: `${name}-${crypto.randomUUID()}`,
              account: { create: { status: "ACTIVE" } },
            },
            select: { id: true, clerkId: true },
          }),
        ),
      );
      service = new SocialService(db, store, () => now);
      vi.mocked(getDb).mockReturnValue(db);
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    });
    afterEach(async () => {
      await db.user.deleteMany({
        where: { id: { in: actors.map((a) => a.id) } },
      });
      vi.unstubAllEnvs();
    });
    afterAll(async () => {
      await db?.$disconnect();
      if (directory) await rm(directory, { recursive: true, force: true });
    });
    const friends = async (a = 0, b = 1) => {
      await service.relationship(actors[a].clerkId, actors[b].id, "request");
      await service.relationship(actors[b].clerkId, actors[a].id, "accept");
    };
    it("denies strangers and pending requests, allows accepted friends, and immediately revokes on block/unfriend", async () => {
      const post = await service.createPost(
        actors[0].clerkId,
        "Private thought",
      );
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await service.relationship(actors[0].clerkId, actors[1].id, "request");
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.relationship(actors[0].clerkId, actors[1].id, "accept"),
      ).rejects.toMatchObject({ status: 409 });
      await service.relationship(actors[1].clerkId, actors[0].id, "accept");
      expect((await service.readPost(actors[1].clerkId, post.id)).body).toBe(
        "Private thought",
      );
      await service.relationship(actors[1].clerkId, actors[0].id, "block");
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await service.relationship(actors[1].clerkId, actors[0].id, "unblock");
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await friends();
      await service.relationship(actors[0].clerkId, actors[1].id, "remove");
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.relationship(actors[0].clerkId, actors[0].id, "request"),
      ).rejects.toMatchObject({ status: 400 });
    });
    it("delivers real normalized bytes only to current audience and never returns an object key", async () => {
      const post = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "A red photograph",
      );
      const id = post.photos[0].photo.id;
      expect(JSON.stringify(post)).not.toMatch(/social\/|objectKey|clerkId/);
      const calls = vi.mocked(store.get).mock.calls.length;
      await expect(
        service.readPhoto(actors[2].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      expect(vi.mocked(store.get).mock.calls.length).toBe(calls);
      await friends();
      const bytes = await service.readPhoto(actors[1].clerkId, id);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      await service.relationship(actors[0].clerkId, actors[1].id, "block");
      await expect(
        service.readPhoto(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      expect(await service.readPhoto(actors[0].clerkId, id)).toEqual(bytes);
    });
    it("enforces ownership, preserves gallery on post deletion, and denies media immediately before physical deletion", async () => {
      const post = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Red",
      );
      const id = post.photos[0].photo.id;
      await friends();
      await expect(
        service.deletePost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.deletePhoto(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      await service.deletePost(actors[0].clerkId, post.id);
      await expect(
        service.readPost(actors[0].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(await service.readPhoto(actors[1].clerkId, id)).toBeInstanceOf(
        Uint8Array,
      );
      vi.mocked(store.delete).mockRejectedValueOnce(
        new Error("storage outage"),
      );
      await expect(service.deletePhoto(actors[0].clerkId, id)).rejects.toThrow(
        "storage outage",
      );
      await expect(
        service.readPhoto(actors[0].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      vi.mocked(store.delete).mockRejectedValueOnce(
        new Error("storage outage"),
      );
      await expect(service.purgeDeletedPhotos()).rejects.toThrow(
        "storage outage",
      );
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "DELETE_PENDING",
      );
      expect(await service.purgeDeletedPhotos()).toBe(1);
      expect(await service.purgeDeletedPhotos()).toBe(0);
      await service.deletePhoto(actors[0].clerkId, id);
    });
    it("serializes concurrent daily post limits and exclusive link posts", async () => {
      const posts = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          service.createPost(actors[0].clerkId, `Thought ${i}`),
        ),
      );
      expect(posts.filter((p) => p.status === "fulfilled")).toHaveLength(3);
      const linked = await Promise.allSettled([
        service.createPost(actors[1].clerkId, "https://example.com"),
        service.createPost(actors[1].clerkId, "Regular"),
      ]);
      expect(linked.filter((p) => p.status === "fulfilled")).toHaveLength(1);
    });
    it("enforces the daily photograph limit independently of available post slots", async () => {
      const owner = actors[0];
      // Gallery photos survive post deletion, leaving the post allowance unused.
      for (let index = 0; index < 2; index++) {
        const post = await service.createPhotoPost(
          owner.clerkId,
          photo,
          "image/jpeg",
          "Red",
        );
        await service.deletePost(owner.clerkId, post.id);
      }
      expect(
        await db.post.count({ where: { ownerId: owner.id, deletedAt: null } }),
      ).toBe(0);
      const images = await Promise.allSettled(
        Array.from({ length: 2 }, () =>
          service.createPhotoPost(owner.clerkId, photo, "image/jpeg", "Red"),
        ),
      );
      expect(images.filter((p) => p.status === "fulfilled")).toHaveLength(1);
      expect(images.find((p) => p.status === "rejected")?.reason).toMatchObject(
        {
          status: 409,
          message: "Daily photograph allowance reached",
        },
      );
      expect(
        await db.galleryEntry.count({ where: { ownerId: owner.id } }),
      ).toBe(3);
      expect(
        await db.photo.count({ where: { ownerId: owner.id, state: "READY" } }),
      ).toBe(3);
      expect(
        await db.post.count({ where: { ownerId: owner.id, deletedAt: null } }),
      ).toBe(1);
    });
    it("denies expired posts, pending/deactivated accounts, and revoked authors with stale sessions", async () => {
      const post = await service.createPost(actors[0].clerkId, "Expires");
      await friends();
      now = new Date("2026-11-29T17:00:00Z");
      await expect(
        service.readPost(actors[1].clerkId, post.id),
      ).rejects.toMatchObject({ status: 404 });
      await db.account.update({
        where: { userId: actors[1].id },
        data: { status: "PENDING" },
      });
      await expect(
        service.createPost(actors[1].clerkId, "No"),
      ).rejects.toMatchObject({ status: 403 });
      await service.deactivate(actors[0].clerkId);
      await expect(
        service.createPost(actors[0].clerkId, "No"),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.createPost("local-preview:ines", "No"),
      ).rejects.toMatchObject({ status: 403 });
      await expect(service.createPost("", "No")).rejects.toMatchObject({
        status: 401,
      });
    });
    it("database constraints reject cross-owner references and the runtime cannot change schema", async () => {
      const post = await service.createPost(actors[0].clerkId, "Owned post");
      const other = await service.createPhotoPost(
        actors[1].clerkId,
        photo,
        "image/jpeg",
        "Other photo",
      );
      await expect(
        db.postPhoto.create({
          data: {
            postId: post.id,
            photoId: other.photos[0].photo.id,
            ownerId: actors[0].id,
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      const permissions = await db.$queryRaw<
        Array<{
          create_schema: boolean;
          superuser: boolean;
          bypass: boolean;
          migration_write: boolean;
        }>
      >`SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS create_schema, rolsuper AS superuser, rolbypassrls AS bypass, has_table_privilege(current_user, '\"_prisma_migrations\"', 'UPDATE') AS migration_write FROM pg_roles WHERE rolname=current_user`;
      expect(permissions[0]).toEqual({
        create_schema: false,
        superuser: false,
        bypass: false,
        migration_write: false,
      });
    });
    it("enforces the 20-photo gallery cap and Los Angeles day boundary in the database", async () => {
      for (let index = 0; index < 20; index++) {
        await db.photo.create({
          data: {
            ownerId: actors[0].id,
            objectKey: `fixture/${crypto.randomUUID()}`,
            state: "READY",
            dayKey: "2026-10-28",
            uploadExpiresAt: now,
            description: "Fixture",
            width: 1,
            height: 1,
            byteLength: 1,
            gallery: { create: {} },
          },
        });
      }
      await expect(
        service.createPhotoPost(
          actors[0].clerkId,
          photo,
          "image/jpeg",
          "No slot",
        ),
      ).rejects.toMatchObject({ status: 409 });
      now = new Date("2026-10-30T06:59:00Z");
      for (let index = 0; index < 3; index++)
        await service.createPost(actors[1].clerkId, `Before midnight ${index}`);
      await expect(
        service.createPost(actors[1].clerkId, "Full"),
      ).rejects.toMatchObject({ status: 409 });
      now = new Date("2026-10-30T07:01:00Z");
      expect(
        (await service.createPost(actors[1].clerkId, "New LA day")).body,
      ).toBe("New LA day");
    });
    it("deactivation revokes photo reads for both owner and friends and expiry cleanup is repeatable", async () => {
      const post = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Revoked",
      );
      await friends();
      const id = post.photos[0].photo.id;
      await service.deactivate(actors[0].clerkId);
      await expect(
        service.readPhoto(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.readPhoto(actors[0].clerkId, id),
      ).rejects.toMatchObject({ status: 403 });
      expect(await service.purgeDeletedPhotos()).toBe(1);
      const text = await service.createPost(
        actors[1].clerkId,
        "Retention canary",
      );
      now = new Date("2026-11-29T17:00:00Z");
      expect(await service.expirePosts()).toBe(1);
      expect(await service.expirePosts()).toBe(0);
      expect(
        (await db.post.findUniqueOrThrow({ where: { id: text.id } })).body,
      ).toBe("");
    });
    it("HTTP uses session identity, strict input, origin checks, private headers and authorization before storage", async () => {
      const post = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Red",
      );
      const id = post.photos[0].photo.id;
      session.subject = actors[2].clerkId;
      const storageGet = vi
        .spyOn(privatePhotoStore, "get")
        .mockImplementation(store.get);
      const denied = await socialRequest(
        new Request(`http://localhost:3000/api/photos/${id}`),
        "readPhoto",
        id,
      );
      expect(denied.status).toBe(404);
      expect(storageGet).not.toHaveBeenCalled();
      expect(denied.headers.get("cache-control")).toBe("private, no-store");
      expect(denied.headers.get("x-robots-tag")).toContain("noindex");
      await friends(0, 2);
      const allowed = await socialRequest(
        new Request(`http://localhost:3000/api/photos/${id}`),
        "readPhoto",
        id,
      );
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("content-type")).toBe("image/webp");
      expect((await allowed.arrayBuffer()).byteLength).toBeGreaterThan(0);
      const request = (origin: string, body: object) =>
        new Request("http://localhost:3000/api/posts", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      expect(
        (
          await socialRequest(
            request("https://evil.invalid", { body: "No" }),
            "createPost",
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await socialRequest(
            request("http://localhost:3000", {
              body: "No",
              ownerId: actors[0].id,
            }),
            "createPost",
          )
        ).status,
      ).toBe(400);
      vi.mocked(enforceRateLimit).mockRejectedValueOnce(
        new Error("Redis unavailable"),
      );
      expect(
        (
          await socialRequest(
            request("http://localhost:3000", { body: "No" }),
            "createPost",
          )
        ).status,
      ).toBe(503);
    });
    it("completes the HTTP account/friend/post/photo/delete slice against the real database", async () => {
      vi.spyOn(privatePhotoStore, "put").mockImplementation(store.put);
      vi.spyOn(privatePhotoStore, "get").mockImplementation(store.get);
      vi.spyOn(privatePhotoStore, "delete").mockImplementation(store.delete);
      const request = (path: string, method = "GET", body?: object) =>
        new Request(`http://localhost:3000/api/${path}`, {
          method,
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      session.subject = actors[0].clerkId;
      expect(
        (await (await socialRequest(request("account"), "account")).json())
          .accountStatus,
      ).toBe("ACTIVE");
      const created = await socialRequest(
        request("posts", "POST", { body: "HTTP private thought" }),
        "createPost",
      );
      expect(created.status).toBe(201);
      const post = await created.json();
      const uploaded = await socialRequest(
        new Request("http://localhost:3000/api/posts/photo", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "image/jpeg",
            "x-photo-description": "HTTP photo",
          },
          body: new Uint8Array(photo),
        }),
        "createPhotoPost",
      );
      expect(uploaded.status).toBe(201);
      const photoPost = await uploaded.json();
      const photoId = photoPost.photos[0].photo.id;
      expect(
        (
          await socialRequest(
            request("relationships", "POST", {
              targetId: actors[1].id,
              action: "request",
            }),
            "relationship",
          )
        ).status,
      ).toBe(204);
      session.subject = actors[1].clerkId;
      expect(
        (
          await socialRequest(
            request("relationships", "POST", {
              targetId: actors[0].id,
              action: "accept",
            }),
            "relationship",
          )
        ).status,
      ).toBe(204);
      expect(
        (await socialRequest(request(`posts/${post.id}`), "readPost", post.id))
          .status,
      ).toBe(200);
      expect(
        (
          await socialRequest(
            request(`photos/${photoId}`, "DELETE"),
            "deletePhoto",
            photoId,
          )
        ).status,
      ).toBe(404);
      session.subject = actors[0].clerkId;
      expect(
        (
          await socialRequest(
            request(`photos/${photoId}`, "DELETE"),
            "deletePhoto",
            photoId,
          )
        ).status,
      ).toBe(204);
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photoId } })).state,
      ).toBe("PURGED");
      expect(
        (
          await socialRequest(
            request(`posts/${post.id}`, "DELETE"),
            "deletePost",
            post.id,
          )
        ).status,
      ).toBe(204);
      expect(
        (await socialRequest(request(`posts/${post.id}`), "readPost", post.id))
          .status,
      ).toBe(404);
      expect(
        (await socialRequest(request("account", "DELETE"), "deactivate"))
          .status,
      ).toBe(204);
      expect(
        (
          await socialRequest(
            request("posts", "POST", { body: "No stale session write" }),
            "createPost",
          )
        ).status,
      ).toBe(403);
    });
    it("rejects malformed uploads without serving them and releases failed reservations for retry", async () => {
      await expect(
        service.createPhotoPost(
          actors[0].clerkId,
          new Uint8Array([1, 2]),
          "image/jpeg",
          "Invalid",
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(
        await db.photo.count({
          where: { ownerId: actors[0].id, state: "READY" },
        }),
      ).toBe(0);
      vi.mocked(store.put).mockRejectedValueOnce(new Error("upload outage"));
      await expect(
        service.createPhotoPost(actors[0].clerkId, photo, "image/jpeg", "Red"),
      ).rejects.toThrow("upload outage");
      expect(
        (
          await service.createPhotoPost(
            actors[0].clerkId,
            photo,
            "image/jpeg",
            "Retry",
          )
        ).photos,
      ).toHaveLength(1);
      await expect(
        normalizePhoto(photo, "image/svg+xml"),
      ).rejects.toMatchObject({ status: 415 });
    });
  },
);
