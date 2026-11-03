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
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { SpaceService } from "@/server/spaces/service";
import { calvinEvent } from "./helpers/ticketmaster-fixture";
import { SocialService } from "@/server/social/service";
import { normalizePhoto, type PrivatePhotoStore } from "@/server/social/photo";
import { getDb } from "@/server/db";
import { privatePhotoStore } from "@/server/social/photo";
import { socialRequest } from "@/server/social/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { completeAccountOnboarding } from "@/server/account/service";
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
              account: { create: { status: "ACTIVE", displayName: name } },
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
      vi.useRealTimers();
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
    const publicEvents = () =>
      new SpaceService(db, store, () => now, {
        event: async () => calvinEvent,
        search: async (q) => ({
          events:
            calvinEvent.name.toLowerCase().includes(q.toLowerCase()) || !q
              ? [calvinEvent]
              : [],
          nextPage: null,
        }),
      });
    it("space composer: multipart publishing keeps text and three mixed attachments in one protected post", async () => {
      now = new Date();
      vi.spyOn(privatePhotoStore, "put").mockImplementation(store.put);
      vi.spyOn(privatePhotoStore, "get").mockImplementation(store.get);
      const spaces = publicEvents();
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Composer",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      const saved = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Saved photograph",
      );
      session.subject = actors[0].clerkId;
      const form = new FormData();
      form.set(
        "input",
        JSON.stringify({
          body: "Une soirée ensemble",
          photoIds: [saved.photos[0].photo.id],
        }),
      );
      for (const description of ["Une rivière", "The evening sky"]) {
        form.append(
          "photos",
          new File([new Uint8Array(photo)], "day.jpg", { type: "image/jpeg" }),
        );
        form.append("descriptions", description);
      }
      const response = await socialRequest(
        new Request(`http://localhost:3000/api/spaces/${room.id}/posts`, {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: form,
        }),
        "spacePublish",
        room.id,
      );
      expect(response.status).toBe(201);
      const { id } = await response.json();
      const posts = (await spaces.posts(actors[1].clerkId, room.id)).posts;
      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({ id, body: "Une soirée ensemble" });
      expect(posts[0].photos.map((p) => p.description).sort()).toEqual([
        "Saved photograph",
        "The evening sky",
        "Une rivière",
      ]);
      expect(
        await db.galleryEntry.count({ where: { ownerId: actors[0].id } }),
      ).toBe(1);
      for (const image of posts[0].photos) {
        const bytes = await spaces.readPhoto(actors[1].clerkId, image.id);
        expect((await sharp(bytes).metadata()).exif).toBeUndefined();
        await expect(
          spaces.readPhoto(actors[2].clerkId, image.id),
        ).rejects.toMatchObject({ status: 404 });
      }
      await expect(
        spaces.publishWithUploads(
          actors[0].clerkId,
          room.id,
          { body: "Over allowance", photoIds: [] },
          [
            {
              bytes: photo,
              type: "image/jpeg",
              description: "Fourth photograph",
            },
          ],
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("space composer: concurrent batches respect the shared image quota without partial posts", async () => {
      const spaces = publicEvents();
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Concurrent composer",
      });
      const batch = [1, 2].map((n) => ({
        bytes: photo,
        type: "image/jpeg",
        description: `Photograph ${n}`,
      }));
      const results = await Promise.allSettled(
        [1, 2].map((n) =>
          spaces.publishWithUploads(
            actors[0].clerkId,
            room.id,
            { body: `Batch ${n}`, photoIds: [] },
            batch,
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toMatchObject([{ reason: { status: 409 } }]);
      const posts = (await spaces.posts(actors[0].clerkId, room.id)).posts;
      expect(posts).toHaveLength(1);
      expect(posts[0].photos).toHaveLength(2);
      expect(await db.photo.count({ where: { ownerId: actors[0].id } })).toBe(
        2,
      );
    });
    it("space composer: bad image bytes retire the whole batch without publishing text or attachments", async () => {
      const spaces = publicEvents();
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Failed composer",
      });
      await expect(
        spaces.publishWithUploads(
          actors[0].clerkId,
          room.id,
          { body: "Not published", photoIds: [] },
          [
            { bytes: photo, type: "image/jpeg", description: "Valid" },
            {
              bytes: new Uint8Array([1, 2, 3]),
              type: "image/jpeg",
              description: "Invalid",
            },
          ],
        ),
      ).rejects.toBeDefined();
      expect(
        (await spaces.posts(actors[0].clerkId, room.id)).posts,
      ).toHaveLength(0);
      expect(
        await db.photo.count({
          where: { ownerId: actors[0].id, state: "DELETE_PENDING" },
        }),
      ).toBe(2);
      expect(
        await db.photo.count({
          where: { ownerId: actors[0].id, state: "READY" },
        }),
      ).toBe(0);
    });
    it("space composer: membership is checked before reservation and again after storage", async () => {
      const spaces = publicEvents();
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Revoked composer",
      });
      const batch = [
        { bytes: photo, type: "image/jpeg", description: "Unpublished" },
      ];
      await expect(
        spaces.publishWithUploads(
          actors[2].clerkId,
          room.id,
          { body: "Denied", photoIds: [] },
          batch,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(await db.photo.count({ where: { ownerId: actors[2].id } })).toBe(
        0,
      );
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      const revoked = new SpaceService(
        db,
        {
          ...store,
          put: async (key, bytes) => {
            await store.put(key, bytes);
            await spaces.member(actors[0].clerkId, room.id, {
              action: "remove",
              userId: actors[1].id,
            });
          },
        },
        () => now,
      );
      await expect(
        revoked.publishWithUploads(
          actors[1].clerkId,
          room.id,
          { body: "Denied after storage", photoIds: [] },
          batch,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await spaces.posts(actors[0].clerkId, room.id)).posts,
      ).toHaveLength(0);
      expect(
        await db.photo.count({
          where: { ownerId: actors[1].id, state: "DELETE_PENDING" },
        }),
      ).toBe(1);
    });
    it("space composer: multipart parsing rejects extra fields and oversized attachment counts", async () => {
      const spaces = publicEvents();
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Bounded composer",
      });
      session.subject = actors[0].clerkId;
      for (const extra of [true, false]) {
        const form = new FormData();
        form.set("input", JSON.stringify({ body: "Invalid", photoIds: [] }));
        if (extra) form.set("ownerId", actors[2].id);
        for (let n = 0; n < (extra ? 1 : 4); n++) {
          form.append(
            "photos",
            new File([new Uint8Array(photo)], "day.jpg", {
              type: "image/jpeg",
            }),
          );
          form.append("descriptions", "Photograph");
        }
        const response = await socialRequest(
          new Request(`http://localhost:3000/api/spaces/${room.id}/posts`, {
            method: "POST",
            headers: { origin: "http://localhost:3000" },
            body: form,
          }),
          "spacePublish",
          room.id,
        );
        expect(response.status).toBe(400);
      }
      expect(await db.photo.count({ where: { ownerId: actors[0].id } })).toBe(
        0,
      );
    });
    it("event lifecycle: public discovery lets nonfriends join while Gatherings and pre-join content remain private", async () => {
      const spaces = publicEvents();
      const event = await spaces.joinTicketmasterEvent(
        actors[0].clerkId,
        calvinEvent.id,
      );
      const gathering = await spaces.createSpace(actors[0].clerkId, {
        kind: "GATHERING",
        name: "Calvin Harris private plans",
        startsAt: calvinEvent.startsAt,
        timeZone: calvinEvent.timeZone,
      });
      await spaces.publish(actors[0].clerkId, event.id, {
        body: "Members only",
        photoIds: [],
      });
      const found = await spaces.searchEvents(
        actors[1].clerkId,
        "Calvin Harris",
      );
      expect(found.events).toHaveLength(1);
      expect(found.events[0]).toMatchObject({
        id: event.id,
        isMember: false,
        imageUrl: calvinEvent.imageUrl,
      });
      expect(found.events[0]).not.toHaveProperty("memberships");
      await expect(
        spaces.posts(actors[1].clerkId, event.id),
      ).rejects.toMatchObject({ status: 404 });
      await spaces.joinTicketmasterEvent(actors[1].clerkId, calvinEvent.id);
      expect((await spaces.readSpace(actors[1].clerkId, event.id)).role).toBe(
        "MEMBER",
      );
      expect(
        (await spaces.posts(actors[1].clerkId, event.id)).posts,
      ).toHaveLength(1);
      await expect(
        spaces.joinEvent(actors[1].clerkId, gathering.id),
      ).rejects.toMatchObject({ status: 404 });
      await db.account.update({
        where: { userId: actors[2].id },
        data: { status: "PENDING" },
      });
      await expect(
        spaces.joinTicketmasterEvent(actors[2].clerkId, calvinEvent.id),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("event lifecycle: defaults to four hours, shares one Space across concurrent joins, and permits only admins to change the end", async () => {
      const spaces = publicEvents();
      const results = await Promise.all(
        actors.map((actor) =>
          spaces.joinTicketmasterEvent(actor.clerkId, calvinEvent.id),
        ),
      );
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      const members = await db.spaceMembership.findMany({
        where: { spaceId: results[0].id },
      });
      expect(members).toHaveLength(3);
      expect(members.filter((m) => m.role === "ADMIN")).toHaveLength(1);
      const row = await db.space.findUniqueOrThrow({
        where: { id: results[0].id },
      });
      expect(row.expiresAt?.toISOString()).toBe("2026-11-10T10:30:00.000Z");
      await expect(
        db.space.create({ data: { ...row, id: undefined } }),
      ).rejects.toMatchObject({ code: "P2002" });
      const creator = actors.find((a) => a.id === row.creatorId)!;
      expect(row.endsAt?.toISOString()).toBe("2026-11-08T10:30:00.000Z");
      const other = actors.find((a) => a.id !== row.creatorId)!;
      await expect(
        spaces.updateEventSchedule(
          other.clerkId,
          row.id,
          "2026-11-08T12:00:00Z",
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        spaces.updateEventSchedule(
          creator.clerkId,
          row.id,
          "2026-11-07T00:00:00Z",
        ),
      ).rejects.toMatchObject({ status: 400 });
      const post = await spaces.publish(creator.clerkId, row.id, {
        body: "Adjust my deadline",
        photoIds: [],
      });
      await spaces.updateEventSchedule(
        creator.clerkId,
        row.id,
        "2026-11-08T12:00:00Z",
      );
      expect(
        (
          await db.space.findUniqueOrThrow({ where: { id: row.id } })
        ).expiresAt?.toISOString(),
      ).toBe("2026-11-10T12:00:00.000Z");
      expect(
        (
          await db.post.findUniqueOrThrow({ where: { id: post.id } })
        ).expiresAt.toISOString(),
      ).toBe("2026-11-10T12:00:00.000Z");
      await spaces.updateEventSchedule(
        creator.clerkId,
        row.id,
        "2026-11-08T10:30:00Z",
      );
      expect(
        (
          await db.post.findUniqueOrThrow({ where: { id: post.id } })
        ).expiresAt.toISOString(),
      ).toBe("2026-11-10T10:30:00.000Z");

      await expect(
        spaces.updateSpace(creator.clerkId, row.id, {
          kind: "GATHERING",
          name: "Change",
          startsAt: calvinEvent.startsAt,
          timeZone: calvinEvent.timeZone,
        }),
      ).rejects.toMatchObject({ status: 409 });
      const privateInput = {
        kind: "GATHERING" as const,
        name: "Dinner",
        startsAt: calvinEvent.startsAt,
        timeZone: calvinEvent.timeZone,
      };
      const [a, b] = await Promise.all([
        spaces.createSpace(creator.clerkId, privateInput),
        spaces.createSpace(creator.clerkId, privateInput),
      ]);
      expect(a.id).not.toBe(b.id);
    });
    it("event lifecycle: expires details, posts, photos, comments, feed and joining exactly 48 hours after the end", async () => {
      const spaces = publicEvents();
      const room = await spaces.joinTicketmasterEvent(
        actors[0].clerkId,
        calvinEvent.id,
      );
      await spaces.joinEvent(actors[1].clerkId, room.id);
      const uploaded = await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Event photo",
        room.id,
      );
      const photoId = uploaded.photos[0].photo.id;
      await spaces.comment(actors[1].clerkId, uploaded.id, {
        body: "See you there",
      });
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
      now = new Date("2026-11-10T10:29:59.999Z");
      expect(
        (await spaces.posts(actors[1].clerkId, room.id)).posts,
      ).toHaveLength(1);
      expect(
        (await spaces.readPhoto(actors[1].clerkId, photoId)).length,
      ).toBeGreaterThan(0);
      now = new Date("2026-11-10T10:30:00Z");
      await expect(
        spaces.readSpace(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.posts(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.readPost(actors[1].clerkId, uploaded.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.readPhoto(actors[1].clerkId, photoId),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.comments(actors[1].clerkId, uploaded.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.joinTicketmasterEvent(actors[2].clerkId, calvinEvent.id),
      ).rejects.toMatchObject({ status: 404 });
      expect((await spaces.feed(actors[1].clerkId)).posts).toEqual([]);
      expect((await spaces.listSpaces(actors[1].clerkId)).spaces).toEqual([]);
      expect(
        (await spaces.searchEvents(actors[1].clerkId, "Calvin Harris")).events,
      ).toEqual([]);
      expect(await spaces.expireSpaces()).toBe(1);
      expect(await spaces.expireSpaces()).toBe(0);
      expect(
        await db.postComment.count({ where: { postId: uploaded.id } }),
      ).toBe(0);
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photoId } })).state,
      ).toBe("DELETE_PENDING");
      await spaces.purgeDeletedPhotos();
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photoId } })).state,
      ).toBe("PURGED");
    });
    it.each(["PRIVATE", "GATHERING", "EVENT", "ARCHIVED_GATHERING"] as const)(
      "space leaving: creators can leave %s, hand over ownership, and the last member can also leave",
      async (kind) => {
        const spaces = publicEvents();
        const input =
          kind === "PRIVATE"
            ? { kind: "PRIVATE" as const, name: "Leave test" }
            : {
                kind: "GATHERING" as const,
                name: "Leave test",
                startsAt: "2027-01-01T12:00:00Z",
                timeZone: "UTC",
              };
        const room =
          kind === "EVENT"
            ? await spaces.joinTicketmasterEvent(
                actors[0].clerkId,
                calvinEvent.id,
              )
            : await spaces.createSpace(actors[0].clerkId, input);
        const invite = await spaces.invite(
          actors[0].clerkId,
          room.id,
          actors[1].id,
        );
        await spaces.accept(actors[1].clerkId, invite.id);
        await spaces.invite(actors[0].clerkId, room.id, actors[2].id);
        const post = await spaces.publish(actors[0].clerkId, room.id, {
          body: "Keep this for remaining members",
          photoIds: [],
        });
        if (kind === "ARCHIVED_GATHERING")
          await spaces.archive(actors[0].clerkId, room.id);
        await spaces.member(actors[0].clerkId, room.id, {
          action: "remove",
          userId: actors[0].id,
        });
        await expect(
          spaces.readSpace(actors[0].clerkId, room.id),
        ).rejects.toMatchObject({ status: 404 });
        expect(
          await spaces.readSpace(actors[1].clerkId, room.id),
        ).toMatchObject({
          creatorId: actors[1].id,
          role: "ADMIN",
          memberCount: 1,
        });
        expect(
          (await spaces.posts(actors[1].clerkId, room.id)).posts[0].id,
        ).toBe(post.id);
        expect(
          await db.spaceInvitation.count({ where: { spaceId: room.id } }),
        ).toBe(0);
        await spaces.member(actors[1].clerkId, room.id, {
          action: "remove",
          userId: actors[1].id,
        });
        expect(
          await db.spaceMembership.count({ where: { spaceId: room.id } }),
        ).toBe(0);
        if (kind === "EVENT") {
          expect(
            (await spaces.searchEvents(actors[2].clerkId, "Calvin Harris"))
              .events[0],
          ).toMatchObject({ id: room.id, isMember: false, memberCount: 0 });
          expect(
            await spaces.joinTicketmasterEvent(
              actors[2].clerkId,
              calvinEvent.id,
            ),
          ).toEqual(room);
          expect(
            await spaces.readSpace(actors[2].clerkId, room.id),
          ).toMatchObject({
            creatorId: actors[2].id,
            role: "ADMIN",
            memberCount: 1,
          });
        } else
          expect(
            (await db.space.findUniqueOrThrow({ where: { id: room.id } }))
              .deletedAt,
          ).not.toBeNull();
      },
    );
    it("space leaving: simultaneous departures preserve a joinable canonical event without stranded ownership", async () => {
      const spaces = publicEvents();
      const room = await spaces.joinTicketmasterEvent(
        actors[0].clerkId,
        calvinEvent.id,
      );
      await spaces.joinEvent(actors[1].clerkId, room.id);
      await Promise.all(
        actors.slice(0, 2).map((actor) =>
          spaces.member(actor.clerkId, room.id, {
            action: "remove",
            userId: actor.id,
          }),
        ),
      );
      expect(
        await db.spaceMembership.count({ where: { spaceId: room.id } }),
      ).toBe(0);
      await spaces.joinEvent(actors[2].clerkId, room.id);
      expect(await spaces.readSpace(actors[2].clerkId, room.id)).toMatchObject({
        creatorId: actors[2].id,
        role: "ADMIN",
      });
    });
    it("persists an invited account's UI read model, accepted-friend access and photo/post deletion", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "1");
      await db.account.update({
        where: { userId: actors[0].id },
        data: { invitationsRemaining: 1 },
      });
      const invitation = { code: "s".repeat(43) };
      await db.invitation.create({
        data: {
          digest: createHash("sha256").update(invitation.code).digest("hex"),
          email: "invited@example.invalid",
          expiresAt: new Date(now.getTime() + 30 * 86400000),
        },
      });
      const subject = `invited-${crypto.randomUUID()}`;
      // Authentication and invitation races are exercised in auth-db.integration.test.ts.
      // This journey begins with that boundary's provider-verified identity.
      await completeAccountOnboarding(
        db,
        { subject, verifiedEmail: "invited@example.invalid" },
        { name: "Invited member", username: "invited_member", bio: "" },
        invitation.code,
        now,
      );
      const account = (await service.account(subject))!;
      actors.push({ id: account.id, clerkId: subject });
      expect(account.accountStatus).toBe("PENDING");
      await expect(
        service.createPost(subject, "Not active yet"),
      ).rejects.toMatchObject({ status: 403 });
      // Test fixture models an explicit operator activation; no public self-activation path exists.
      await db.account.update({
        where: { userId: account.id },
        data: { status: "ACTIVE" },
      });
      const post = await service.createPost(subject, "A durable first post");
      const photoPost = await service.createPhotoPost(
        subject,
        photo,
        "image/jpeg",
        "Une rivière près de chez moi",
      );
      const photoId = photoPost.photos[0].photo.id;
      expect((await service.profile(subject, account.id)).profile.name).toBe(
        "Invited member",
      );
      expect(
        (await service.profile(actors[1].clerkId, account.id)).posts,
      ).toEqual([]);
      await service.relationship(subject, actors[1].id, "request");
      expect(
        (await service.profile(actors[1].clerkId, actors[1].id)).requests,
      ).toContainEqual({ id: account.id, name: "Invited member" });
      expect(
        (await service.profile(actors[1].clerkId, account.id)).profile
          .relationship,
      ).toBe("incoming");
      await service.relationship(actors[1].clerkId, account.id, "accept");
      // A fresh service/read after creation models refresh/sign-in persistence rather than UI memory.
      const reopened = new SocialService(db, store, () => now);
      const visible = await reopened.profile(actors[1].clerkId, account.id);
      expect(visible.posts).toHaveLength(2);
      expect(visible.gallery[0].id).toBe(photoId);
      expect(JSON.stringify(visible)).not.toContain(subject);
      expect(JSON.stringify(visible)).not.toContain("objectKey");
      expect(
        (await reopened.readPhoto(actors[1].clerkId, photoId)).length,
      ).toBeGreaterThan(0);
      await expect(
        reopened.readPhoto(actors[2].clerkId, photoId),
      ).rejects.toMatchObject({ status: 404 });
      await service.relationship(subject, actors[1].id, "remove");
      const revoked = await reopened.profile(actors[1].clerkId, account.id);
      expect(revoked.posts).toEqual([]);
      expect(revoked.gallery).toEqual([]);
      await service.deletePhoto(subject, photoId);
      await expect(reopened.readPhoto(subject, photoId)).rejects.toMatchObject({
        status: 404,
      });
      await service.deletePost(subject, post.id);
      const remaining = await reopened.profile(subject, account.id);
      expect(remaining.posts).not.toContainEqual(
        expect.objectContaining({ id: post.id }),
      );
      expect(remaining.gallery).toEqual([]);
      expect(
        await db.post.findUniqueOrThrow({ where: { id: post.id } }),
      ).toMatchObject({ body: "" });
      expect(
        await db.photo.findUniqueOrThrow({ where: { id: photoId } }),
      ).toMatchObject({ state: "PURGED", description: "" });
    });
    it("bounds and paginates profile reads, rejects foreign cursors, and revokes lists on blocks/deactivation", async () => {
      const createdAt = now;
      const ids = Array.from(
        { length: 22 },
        (_, i) => `profile-page-${String(i).padStart(2, "0")}`,
      );
      await db.post.createMany({
        data: ids.map((id) => ({
          id,
          ownerId: actors[0].id,
          body: id,
          hasLink: false,
          dayKey: "2026-10-29",
          createdAt,
          expiresAt: new Date(now.getTime() + 86400_000),
        })),
      });
      await friends();
      const first = await service.profile(actors[1].clerkId, actors[0].id);
      const second = await service.profile(
        actors[1].clerkId,
        actors[0].id,
        first.nextCursor!,
      );
      expect(first.posts).toHaveLength(20);
      expect(second.posts).toHaveLength(2);
      expect(
        new Set([...first.posts, ...second.posts].map((p) => p.id)).size,
      ).toBe(22);
      const foreign = await service.createPost(
        actors[2].clerkId,
        "Foreign cursor",
      );
      await expect(
        service.profile(actors[1].clerkId, actors[0].id, foreign.id),
      ).rejects.toMatchObject({ status: 404 });
      await service.relationship(actors[0].clerkId, actors[1].id, "block");
      await expect(
        service.profile(actors[1].clerkId, actors[0].id),
      ).rejects.toMatchObject({ status: 404 });
      await db.account.update({
        where: { userId: actors[0].id },
        data: { status: "DEACTIVATED" },
      });
      await expect(
        service.profile(actors[2].clerkId, actors[0].id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("Spaces enforce targeted invitations, membership, independent preferences and revocation", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Reading room",
      });
      await expect(
        spaces.readSpace(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
      const invitation = await spaces.invite(
        actors[0].clerkId,
        room.id,
        actors[1].id,
      );
      await expect(
        spaces.accept(actors[2].clerkId, invitation.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await spaces.listSpaces(actors[1].clerkId)).invitations.map(
          (i) => i.id,
        ),
      ).toContain(invitation.id);
      expect((await spaces.listSpaces(actors[2].clerkId)).invitations).toEqual(
        [],
      );
      await spaces.accept(actors[1].clerkId, invitation.id);
      expect(
        (await spaces.readSpace(actors[1].clerkId, room.id)).members,
      ).toHaveLength(2);
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
      expect(
        (await spaces.readSpace(actors[0].clerkId, room.id)).includeInFeed,
      ).toBe(false);
      expect(
        (await spaces.readSpace(actors[1].clerkId, room.id)).includeInFeed,
      ).toBe(true);
      await expect(
        spaces.invite(actors[1].clerkId, room.id, actors[2].id),
      ).rejects.toMatchObject({ status: 403 });
      await spaces.member(actors[0].clerkId, room.id, {
        action: "remove",
        userId: actors[1].id,
      });
      await expect(
        spaces.readSpace(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.accept(actors[1].clerkId, invitation.id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("only Space administrators archive events, retaining metadata and freezing shared changes", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "GATHERING",
        name: "Dinner",
        startsAt: "2027-01-01T20:00:00Z",
        timeZone: "Europe/Paris",
        location: "At home",
      });
      const invitation = await spaces.invite(
        actors[0].clerkId,
        room.id,
        actors[1].id,
      );
      await spaces.accept(actors[1].clerkId, invitation.id);
      await spaces.member(actors[1].clerkId, room.id, {
        action: "rsvp",
        rsvp: "GOING",
      });
      await expect(
        spaces.archive(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 403 });
      await spaces.member(actors[0].clerkId, room.id, {
        action: "role",
        userId: actors[1].id,
        role: "ADMIN",
      });
      await spaces.archive(actors[1].clerkId, room.id);
      const archived = await spaces.readSpace(actors[1].clerkId, room.id);
      expect(archived.location).toBe("At home");
      expect(archived.rsvp).toBe("GOING");
      expect(archived.archivedAt).not.toBeNull();
      await expect(
        spaces.member(actors[1].clerkId, room.id, {
          action: "rsvp",
          rsvp: "DECLINED",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        spaces.invite(actors[0].clerkId, room.id, actors[2].id),
      ).rejects.toMatchObject({ status: 409 });
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
    });
    it("Space posts are canonical, opt-in feed references and outside personal post allowances", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Shared room",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      await service.createPost(
        actors[0].clerkId,
        "https://example.invalid Personal link allowance",
      );
      const published = await spaces.publish(actors[0].clerkId, room.id, {
        body: "A Space thought",
        photoIds: [],
      });
      await spaces.publish(actors[0].clerkId, room.id, {
        body: "https://example.invalid Space links are separate",
        photoIds: [],
      });
      expect(
        (await spaces.posts(actors[1].clerkId, room.id)).posts.map((p) => p.id),
      ).toContain(published.id);
      expect((await spaces.feed(actors[1].clerkId)).posts).toEqual([]);
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
      expect(
        (await spaces.feed(actors[1].clerkId)).posts.map((p) => p.id),
      ).toContain(published.id);
      expect((await spaces.feed(actors[0].clerkId)).posts).toEqual([]);
      expect(
        (await service.profile(actors[0].clerkId, actors[0].id)).posts,
      ).toHaveLength(1);
      expect(await db.post.count({ where: { id: published.id } })).toBe(1);
      await expect(
        service.createPost(actors[0].clerkId, "No second personal post"),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("mixes opted-in Space references with personal friend posts chronologically and preserves canonical conversations after opting out", async () => {
      const spaces = new SpaceService(db, store, () => now);
      await friends(0, 1);
      const personal = await service.createPost(
        actors[0].clerkId,
        "An older personal post",
      );
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Japan 2027",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      now = new Date(now.getTime() + 1000);
      const shared = await spaces.publish(actors[0].clerkId, room.id, {
        body: "A newer Space post",
        photoIds: [],
      });
      expect(
        (await spaces.feed(actors[1].clerkId)).posts.map((p) => p.id),
      ).toEqual([personal.id]);
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
      const feed = await spaces.feed(actors[1].clerkId);
      expect(feed.posts.map((p) => p.id)).toEqual([shared.id, personal.id]);
      expect(feed.posts[0].space).toMatchObject({
        id: room.id,
        name: "Japan 2027",
      });
      expect(feed.posts[1].space).toBeNull();
      const comment = await spaces.comment(actors[1].clerkId, shared.id, {
        body: "The same conversation",
      });
      expect(
        (await spaces.comments(actors[0].clerkId, shared.id)).comments.map(
          (c) => c.id,
        ),
      ).toContain(comment.id);
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: false,
      });
      expect(
        (await spaces.feed(actors[1].clerkId)).posts.map((p) => p.id),
      ).toEqual([personal.id]);
      expect(
        (await spaces.posts(actors[1].clerkId, room.id)).posts.map((p) => p.id),
      ).toEqual([shared.id]);
      expect(
        (await spaces.comments(actors[1].clerkId, shared.id)).comments.map(
          (c) => c.id,
        ),
      ).toContain(comment.id);
      expect(await db.post.count({ where: { id: shared.id } })).toBe(1);
    });
    it("blocks hide Space contributions and replies without removing membership", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Shared room",
      });
      for (const person of actors.slice(1))
        await spaces.accept(
          person.clerkId,
          (await spaces.invite(actors[0].clerkId, room.id, person.id)).id,
        );
      const alice = await spaces.publish(actors[0].clerkId, room.id, {
        body: "Alice",
        photoIds: [],
      });
      const bob = await spaces.publish(actors[1].clerkId, room.id, {
        body: "Bob",
        photoIds: [],
      });
      const comment = await spaces.comment(actors[0].clerkId, bob.id, {
        body: "Alice's reply",
      });
      await service.relationship(actors[1].clerkId, actors[0].id, "block");
      expect(
        (await spaces.readSpace(actors[1].clerkId, room.id)).memberCount,
      ).toBe(3);
      expect(
        (await spaces.posts(actors[1].clerkId, room.id)).posts.map((p) => p.id),
      ).toEqual([bob.id]);
      expect(
        (await spaces.comments(actors[1].clerkId, bob.id)).comments,
      ).toEqual([]);
      await expect(
        spaces.comment(actors[1].clerkId, bob.id, {
          body: "Direct reply",
          replyTo: comment.id,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        spaces.comment(actors[1].clerkId, alice.id, {
          body: "Direct interaction",
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.readPost(actors[1].clerkId, alice.id),
      ).rejects.toMatchObject({ status: 404 });
      await spaces.member(actors[0].clerkId, room.id, {
        action: "remove",
        userId: actors[2].id,
      });
      await expect(
        spaces.posts(actors[2].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("Space photographs share the three-upload ledger, stay out of Gallery and reuse one object", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Photographs",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      const uploaded = await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Space only",
        room.id,
      );
      const photoId = uploaded.photos[0].photo.id;
      expect(await db.galleryEntry.count({ where: { photoId } })).toBe(0);
      const puts = vi.mocked(store.put).mock.calls.length;
      await spaces.publish(actors[0].clerkId, room.id, {
        body: "Same photograph",
        photoIds: [photoId],
      });
      expect(vi.mocked(store.put).mock.calls.length).toBe(puts);
      expect(await db.spacePhoto.count({ where: { spaceId: room.id } })).toBe(
        1,
      );
      expect(
        (await service.readPhoto(actors[1].clerkId, photoId)).length,
      ).toBeGreaterThan(0);
      await friends(0, 2);
      await expect(
        service.readPhoto(actors[2].clerkId, photoId),
      ).rejects.toMatchObject({ status: 404 });
      await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Two",
        room.id,
      );
      await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Three, personal",
      );
      await expect(
        spaces.createPhotoPost(
          actors[0].clerkId,
          photo,
          "image/jpeg",
          "Four",
          room.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await service.deletePhoto(actors[0].clerkId, photoId);
      await expect(
        spaces.createPhotoPost(
          actors[0].clerkId,
          photo,
          "image/jpeg",
          "Deletion does not refund uploads",
          room.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("reserves the last of 20 canonical Space slots atomically across contributors", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Nearly full",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      for (let i = 0; i < 19; i++)
        await db.photo.create({
          data: {
            ownerId: actors[0].id,
            objectKey: `seed/${crypto.randomUUID()}.webp`,
            dayKey: "2026-10-28",
            description: "Already retained",
            width: 4,
            height: 3,
            byteLength: 100,
            state: "READY",
            uploadedAt: new Date("2026-10-28T12:00:00Z"),
            uploadExpiresAt: now,
            spaceReferences: { create: { spaceId: room.id } },
            posts: {
              create: {
                post: {
                  create: {
                    ownerId: actors[0].id,
                    spaceId: room.id,
                    body: "Existing",
                    hasLink: false,
                    dayKey: "2026-10-28",
                    createdAt: new Date("2026-10-28T12:00:00Z"),
                    expiresAt: new Date("2026-11-27T12:00:00Z"),
                  },
                },
              },
            },
          },
        });
      const results = await Promise.allSettled(
        actors
          .slice(0, 2)
          .map((a) =>
            spaces.createPhotoPost(
              a.clerkId,
              photo,
              "image/jpeg",
              "Last slot",
              room.id,
            ),
          ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toMatchObject([
        { reason: { status: 409 } },
      ]);
      expect(
        await db.spacePhoto.count({
          where: { spaceId: room.id, photo: { state: "READY" } },
        }),
      ).toBe(20);
      const winner = results.find((r) => r.status === "fulfilled")!;
      if (winner.status !== "fulfilled") throw Error("Expected a winner");
      const id = winner.value.photos[0].photo.id;
      const owner = actors.find((a) => a.id === winner.value.ownerId)!;
      await spaces.publish(owner.clerkId, room.id, {
        body: "Another reference at capacity",
        photoIds: [id],
      });
      expect(await db.spacePhoto.count({ where: { spaceId: room.id } })).toBe(
        20,
      );
      await service.deletePost(owner.clerkId, winner.value.id);
      expect(await db.spacePhoto.count({ where: { spaceId: room.id } })).toBe(
        20,
      );
      const last = (await spaces.posts(owner.clerkId, room.id)).posts.find(
        (p) => p.body === "Another reference at capacity",
      )!;
      await service.deletePost(owner.clerkId, last.id);
      expect(await db.spacePhoto.count({ where: { spaceId: room.id } })).toBe(
        19,
      );
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "DELETE_PENDING",
      );
    });
    it("expires comments with their post, frees Space slots, and retains archived event metadata", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "GATHERING",
        name: "Future gathering",
        startsAt: "2027-06-01T12:00:00Z",
        timeZone: "UTC",
        location: "The park",
      });
      await spaces.member(actors[0].clerkId, room.id, {
        action: "rsvp",
        rsvp: "GOING",
      });
      const uploaded = await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Temporary photograph",
        room.id,
      );
      const id = uploaded.photos[0].photo.id;
      await spaces.comment(actors[0].clerkId, uploaded.id, {
        body: "Temporary comment",
      });
      await spaces.archive(actors[0].clerkId, room.id);
      await expect(
        service.deletePhoto(actors[0].clerkId, id),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.deletePost(actors[0].clerkId, uploaded.id),
      ).rejects.toMatchObject({ status: 409 });
      now = new Date(now.getTime() + 30 * 86400_000);
      expect((await spaces.posts(actors[0].clerkId, room.id)).posts).toEqual(
        [],
      );
      await expect(
        spaces.comments(actors[0].clerkId, uploaded.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.readPhoto(actors[0].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      await service.expirePosts(100);
      expect(
        await db.postComment.count({ where: { postId: uploaded.id } }),
      ).toBe(0);
      expect(
        (await db.post.findUniqueOrThrow({ where: { id: uploaded.id } })).body,
      ).toBe("");
      expect(await db.spacePhoto.count({ where: { spaceId: room.id } })).toBe(
        0,
      );
      expect(await service.purgeDeletedPhotos(100)).toBeGreaterThanOrEqual(1);
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "PURGED",
      );
      expect(await spaces.readSpace(actors[0].clerkId, room.id)).toMatchObject({
        name: "Future gathering",
        location: "The park",
        rsvp: "GOING",
        startsAt: "2027-06-01T12:00:00.000Z",
      });
    });
    it("preserves canonical bytes needed by another Space or personal Gallery when references are removed", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const a = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "First",
      });
      const b = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Second",
      });
      const uploaded = await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Shared object",
        a.id,
      );
      const id = uploaded.photos[0].photo.id;
      const other = await spaces.publish(actors[0].clerkId, b.id, {
        body: "Same object",
        photoIds: [id],
      });
      await service.deletePost(actors[0].clerkId, uploaded.id);
      expect(
        (await service.readPhoto(actors[0].clerkId, id)).length,
      ).toBeGreaterThan(0);
      await service.purgeDeletedPhotos(100);
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "READY",
      );
      await service.deletePost(actors[0].clerkId, other.id);
      expect((await db.photo.findUniqueOrThrow({ where: { id } })).state).toBe(
        "DELETE_PENDING",
      );
      const personal = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Gallery retained",
      );
      const galleryId = personal.photos[0].photo.id;
      const spacePost = await spaces.publish(actors[0].clerkId, a.id, {
        body: "Gallery reference",
        photoIds: [galleryId],
      });
      await service.deletePost(actors[0].clerkId, personal.id);
      await service.deletePost(actors[0].clerkId, spacePost.id);
      await service.purgeDeletedPhotos(100);
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: galleryId } })).state,
      ).toBe("READY");
      expect(
        (await service.readPhoto(actors[0].clerkId, galleryId)).length,
      ).toBeGreaterThan(0);
    });
    it("revokes private image URLs and opted-in feed access after blocks and membership removal", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Private bytes",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      await spaces.member(actors[1].clerkId, room.id, {
        action: "preferences",
        includeInFeed: true,
      });
      const uploaded = await spaces.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Member only",
        room.id,
      );
      const id = uploaded.photos[0].photo.id;
      expect(
        (await spaces.feed(actors[1].clerkId)).posts.map((p) => p.id),
      ).toContain(uploaded.id);
      await service.relationship(actors[1].clerkId, actors[0].id, "block");
      await expect(
        service.readPhoto(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      expect((await spaces.feed(actors[1].clerkId)).posts).toEqual([]);
      await service.relationship(actors[1].clerkId, actors[0].id, "unblock");
      expect(
        (await service.readPhoto(actors[1].clerkId, id)).length,
      ).toBeGreaterThan(0);
      const ownUpload = await spaces.createPhotoPost(
        actors[1].clerkId,
        photo,
        "image/jpeg",
        "A contributor's private photograph",
        room.id,
      );
      await spaces.member(actors[0].clerkId, room.id, {
        action: "remove",
        userId: actors[1].id,
      });
      await expect(
        service.readPhoto(actors[1].clerkId, id),
      ).rejects.toMatchObject({ status: 404 });
      expect((await spaces.feed(actors[1].clerkId)).posts).toEqual([]);
      // Upload ownership alone never bypasses the current Space membership.
      await expect(
        service.readPhoto(actors[1].clerkId, ownUpload.photos[0].photo.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (
          await service.readPhoto(
            actors[0].clerkId,
            ownUpload.photos[0].photo.id,
          )
        ).length,
      ).toBeGreaterThan(0);
    });
    it.each([false, true])(
      "lets a noncreator leave and revokes their Space access without removing contributions (archived=%s)",
      async (archived) => {
        const spaces = new SpaceService(db, store, () => now);
        const [owner, member, other] = actors;
        const room = await spaces.createSpace(owner.clerkId, {
          kind: "GATHERING",
          name: "A gathering",
          startsAt: "2027-01-01T12:00:00Z",
          timeZone: "UTC",
        });
        const invitation = await spaces.invite(
          owner.clerkId,
          room.id,
          member.id,
        );
        await spaces.accept(member.clerkId, invitation.id);
        await spaces.accept(
          other.clerkId,
          (await spaces.invite(owner.clerkId, room.id, other.id)).id,
        );
        await spaces.member(member.clerkId, room.id, {
          action: "preferences",
          includeInFeed: true,
        });
        const uploaded = await spaces.createPhotoPost(
          member.clerkId,
          photo,
          "image/jpeg",
          "A shared photograph",
          room.id,
        );
        await spaces.comment(member.clerkId, uploaded.id, {
          body: "A contribution that stays",
        });
        if (archived) await spaces.archive(owner.clerkId, room.id);
        // Neither ordinary membership nor archive status grants authority over others.
        await expect(
          spaces.member(member.clerkId, room.id, {
            action: "remove",
            userId: other.id,
          }),
        ).rejects.toMatchObject({ status: archived ? 409 : 403 });

        await spaces.member(member.clerkId, room.id, {
          action: "remove",
          userId: member.id,
        });
        expect((await spaces.listSpaces(member.clerkId)).spaces).toEqual([]);
        expect((await spaces.feed(member.clerkId)).posts).toEqual([]);
        await expect(
          spaces.readSpace(member.clerkId, room.id),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          spaces.comments(member.clerkId, uploaded.id),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          service.readPhoto(member.clerkId, uploaded.photos[0].photo.id),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          spaces.publish(member.clerkId, room.id, {
            body: "After leaving",
            photoIds: [],
          }),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          spaces.accept(member.clerkId, invitation.id),
        ).rejects.toMatchObject({ status: 404 });
        expect(
          (await spaces.comments(owner.clerkId, uploaded.id)).comments,
        ).toHaveLength(1);
        expect(
          (await service.readPhoto(owner.clerkId, uploaded.photos[0].photo.id))
            .length,
        ).toBeGreaterThan(0);
        expect(
          (await spaces.readSpace(owner.clerkId, room.id)).memberCount,
        ).toBe(2);
        expect(
          await db.spaceMembership.findUnique({
            where: { spaceId_userId: { spaceId: room.id, userId: member.id } },
          }),
        ).toBeNull();
      },
    );
    it("only the creator deletes a Space, erasing event metadata while preserving external image references", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "GATHERING",
        name: "Delete me",
        startsAt: "2027-01-01T12:00:00Z",
        timeZone: "UTC",
        location: "Private address",
      });
      await spaces.accept(
        actors[1].clerkId,
        (await spaces.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      await spaces.member(actors[0].clerkId, room.id, {
        action: "role",
        userId: actors[1].id,
        role: "ADMIN",
      });
      const personal = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Keep in Gallery",
      );
      const shared = await spaces.publish(actors[0].clerkId, room.id, {
        body: "Erase me",
        photoIds: [personal.photos[0].photo.id],
      });
      await spaces.comment(actors[1].clerkId, shared.id, {
        body: "Erase me too",
      });
      await spaces.archive(actors[1].clerkId, room.id);
      await expect(
        spaces.deleteSpace(actors[1].clerkId, room.id),
      ).rejects.toMatchObject({ status: 403 });
      await spaces.deleteSpace(actors[0].clerkId, room.id);
      await expect(
        spaces.readSpace(actors[0].clerkId, room.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await db.space.findUniqueOrThrow({ where: { id: room.id } }),
      ).toMatchObject({
        name: "Deleted Space",
        startsAt: null,
        timeZone: null,
        location: null,
      });
      expect(await db.postComment.count({ where: { postId: shared.id } })).toBe(
        0,
      );
      expect(
        (await db.post.findUniqueOrThrow({ where: { id: shared.id } })).body,
      ).toBe("");
      expect(
        (
          await service.readPhoto(
            actors[0].clerkId,
            personal.photos[0].photo.id,
          )
        ).length,
      ).toBeGreaterThan(0);
    });
    it("pages live conversations without duplicates and rejects replies to a different post", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Conversation",
      });
      const a = await spaces.publish(actors[0].clerkId, room.id, {
        body: "First",
        photoIds: [],
      });
      const b = await spaces.publish(actors[0].clerkId, room.id, {
        body: "Second",
        photoIds: [],
      });
      const ids = [];
      for (let i = 0; i < 21; i++) {
        now = new Date(now.getTime() + 1000);
        ids.push(
          (
            await spaces.comment(actors[0].clerkId, a.id, {
              body: `Comment ${i}`,
            })
          ).id,
        );
      }
      const page = await spaces.comments(actors[0].clerkId, a.id);
      expect(page.comments.map((c) => c.id)).toEqual(ids.slice(1));
      const older = await spaces.comments(
        actors[0].clerkId,
        a.id,
        page.nextCursor!,
      );
      expect(older.comments.map((c) => c.id)).toEqual(ids.slice(0, 1));
      expect(older.nextCursor).toBeNull();
      await expect(
        spaces.comment(actors[0].clerkId, b.id, {
          body: "Wrong conversation",
          replyTo: ids[0],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("archived events deny new posts, uploads and comments while keeping existing conversations readable", async () => {
      const spaces = new SpaceService(db, store, () => now);
      const room = await spaces.createSpace(actors[0].clerkId, {
        kind: "GATHERING",
        name: "Dinner",
        startsAt: "2027-01-01T12:00:00Z",
        timeZone: "UTC",
      });
      const post = await spaces.publish(actors[0].clerkId, room.id, {
        body: "Before archive",
        photoIds: [],
      });
      await spaces.comment(actors[0].clerkId, post.id, {
        body: "Saved comment",
      });
      await spaces.archive(actors[0].clerkId, room.id);
      expect(
        (await spaces.comments(actors[0].clerkId, post.id)).comments,
      ).toHaveLength(1);
      await expect(
        spaces.comment(actors[0].clerkId, post.id, { body: "After" }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        spaces.publish(actors[0].clerkId, room.id, {
          body: "After",
          photoIds: [],
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        spaces.createPhotoPost(
          actors[0].clerkId,
          photo,
          "image/jpeg",
          "After",
          room.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
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
            "x-photo-description": encodeURIComponent(
              "Une rivière près de chez moi",
            ),
            "x-photo-description-encoding": "percent",
          },
          body: new Uint8Array(photo),
        }),
        "createPhotoPost",
      );
      expect(uploaded.status).toBe(201);
      const photoPost = await uploaded.json();
      expect(photoPost.photos[0].photo.description).toBe(
        "Une rivière près de chez moi",
      );
      const photoId = photoPost.photos[0].photo.id;
      const ownProfile = await socialRequest(
        request(`profiles/${actors[0].id}`),
        "profile",
        actors[0].id,
      );
      expect(ownProfile.status).toBe(200);
      expect((await ownProfile.json()).posts).toHaveLength(2);
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
    it("rechecks stale purge candidates before deleting canonical bytes", async () => {
      const uploaded = await service.createPhotoPost(
        actors[0].clerkId,
        photo,
        "image/jpeg",
        "Still referenced",
      );
      const row = await db.photo.findUniqueOrThrow({
        where: { id: uploaded.photos[0].photo.id },
      });
      const scan = vi.spyOn(db.photo, "findMany").mockResolvedValueOnce([row]);
      const deletes = vi.mocked(store.delete).mock.calls.length;
      try {
        expect(await service.purgeDeletedPhotos()).toBe(0);
      } finally {
        scan.mockRestore();
      }
      expect(vi.mocked(store.delete).mock.calls.length).toBe(deletes);
      expect(
        (await service.readPhoto(actors[0].clerkId, row.id)).length,
      ).toBeGreaterThan(0);
    });
    it("runs Space creation, invitation, canonical feed, conversation and deletion through the HTTP boundary", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      const request = (
        path: string,
        method = "GET",
        body?: object,
        origin = "http://localhost:3000",
      ) =>
        new Request(`http://localhost:3000/api/${path}`, {
          method,
          headers: { origin, "content-type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      session.subject = actors[0].clerkId;
      const created = await socialRequest(
        request("spaces", "POST", { kind: "PRIVATE", name: "HTTP Space" }),
        "spaceCreate",
      );
      expect(created.status).toBe(201);
      expect(vi.mocked(enforceRateLimit).mock.calls.at(-1)).toEqual([
        "spaceWrite",
        actors[0].clerkId,
      ]);
      const room = await created.json();
      const invited = await socialRequest(
        request(`spaces/${room.id}/invitations`, "POST", {
          targetId: actors[1].id,
        }),
        "spaceInvite",
        room.id,
      );
      expect(invited.status).toBe(201);
      const invitation = await invited.json();
      session.subject = actors[1].clerkId;
      expect(
        (await (await socialRequest(request("spaces"), "spaceList")).json())
          .invitations,
      ).toHaveLength(1);
      expect(
        (
          await socialRequest(
            request(`space-invitations/${invitation.id}/accept`, "POST"),
            "spaceAccept",
            invitation.id,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await socialRequest(
            request(`spaces/${room.id}/members`, "PATCH", {
              action: "preferences",
              includeInFeed: true,
            }),
            "spaceMember",
            room.id,
          )
        ).status,
      ).toBe(204);
      session.subject = actors[0].clerkId;
      expect(
        (
          await socialRequest(
            request(
              `spaces/${room.id}/posts`,
              "POST",
              { body: "Forgery", photoIds: [] },
              "https://evil.invalid",
            ),
            "spacePublish",
            room.id,
          )
        ).status,
      ).toBe(403);
      const published = await socialRequest(
        request(`spaces/${room.id}/posts`, "POST", {
          body: "Durable Space thought",
          photoIds: [],
        }),
        "spacePublish",
        room.id,
      );
      expect(published.status).toBe(201);
      const post = await published.json();
      session.subject = actors[1].clerkId;
      const feed = await socialRequest(request("feed"), "spaceFeed");
      expect(feed.headers.get("cache-control")).toBe("private, no-store");
      expect((await feed.json()).posts[0]).toMatchObject({
        id: post.id,
        space: { id: room.id, name: "HTTP Space" },
      });
      const commented = await socialRequest(
        request(`posts/${post.id}/comments`, "POST", {
          body: "Persisted reply",
        }),
        "commentCreate",
        post.id,
      );
      expect(commented.status).toBe(201);
      const comments = await socialRequest(
        request(`posts/${post.id}/comments`),
        "commentsRead",
        post.id,
      );
      expect((await comments.json()).comments[0].body).toBe("Persisted reply");
      session.subject = actors[2].clerkId;
      expect(
        (
          await socialRequest(
            request(`posts/${post.id}/comments`),
            "commentsRead",
            post.id,
          )
        ).status,
      ).toBe(404);
      session.subject = actors[0].clerkId;
      expect(
        (
          await socialRequest(
            request(`spaces/${room.id}`, "DELETE"),
            "spaceDelete",
            room.id,
          )
        ).status,
      ).toBe(204);
      session.subject = actors[1].clerkId;
      expect(
        (await (await socialRequest(request("feed"), "spaceFeed")).json())
          .posts,
      ).toEqual([]);
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
