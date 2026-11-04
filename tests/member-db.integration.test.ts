// @vitest-environment node
// Real disposable PostgreSQL, real image normalization/cropping and private file
// bytes. Music catalogue lookups are doubles; no Clerk/Redis/cloud calls.
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
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import { localPhotoStore } from "@/server/social/local-photo-store";
import { catalogue } from "@/server/music/catalogue";
import type { PrivatePhotoStore } from "@/server/social/photo";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "authenticated member experience",
  () => {
    let db: PrismaClient;
    let root: string;
    let store: PrivatePhotoStore;
    let service: MemberService;
    let now = new Date("2026-11-02T20:00:00Z");
    let image: Buffer;
    let actors: { id: string; clerkId: string }[];
    const track = {
      id: "itunes-123",
      title: "Fictional song",
      artist: "Sample artist",
      source: "itunes" as const,
      appleMusicUrl: "https://music.apple.com/us/album/sample/123?i=123",
      spotifyUrl: "https://open.spotify.com/search/Sample%20artist",
    };
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "55432" ||
        !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
        url.username !== "margin_runtime"
      )
        throw Error("Refusing non-disposable database");
      db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 5) });
      root = await mkdtemp(join(tmpdir(), "margin-member-"));
      store = localPhotoStore(root);
      service = new MemberService(db, store, () => now);
      image = await sharp({
        create: { width: 640, height: 480, channels: 3, background: "#52714d" },
      })
        .jpeg()
        .toBuffer();
    });
    beforeEach(async () => {
      now = new Date("2026-11-02T20:00:00Z");
      actors = [];
      for (const [index, status] of [
        "ACTIVE",
        "ACTIVE",
        "ACTIVE",
        "PENDING",
      ].entries())
        actors.push(
          await db.user.create({
            data: {
              clerkId: `member-test-${randomUUID()}`,
              account: {
                create: {
                  status: status as "ACTIVE" | "PENDING",
                  displayName: `Saved member ${index}`,
                  username: `member_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
                  bio: "Saved introduction",
                },
              },
            },
            select: { id: true, clerkId: true },
          }),
        );
      vi.spyOn(catalogue, "lookup").mockResolvedValue(track);
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await db.user.deleteMany({
        where: { id: { in: actors.map((actor) => actor.id) } },
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
      if (root) await rm(root, { recursive: true, force: true });
    });
    async function friends(a = 0, b = 1) {
      await service.relationship(actors[a].clerkId, actors[b].id, "request");
      await service.relationship(actors[b].clerkId, actors[a].id, "accept");
    }

    it.each([false, true])(
      "post photo deletion honors deletePhotos=%s and preserves daily upload accounting",
      async (deletePhotos) => {
        const subject = actors[0].clerkId;
        const post = await service.createPhotoPost(
          subject,
          image,
          "image/jpeg",
        );
        const photoId = post.photos[0].photo.id;
        const other = await service.publishPersonal(subject, {
          body: "Another appearance",
          photoIds: [photoId],
        });
        await service.deletePost(subject, post.id, deletePhotos);
        expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull();
        expect(
          await db.post.findUnique({ where: { id: other.id } }),
        ).not.toBeNull();
        expect(await db.postPhoto.count({ where: { postId: other.id } })).toBe(
          deletePhotos ? 0 : 1,
        );
        expect(await db.galleryEntry.count({ where: { photoId } })).toBe(
          deletePhotos ? 0 : 1,
        );
        expect(
          await db.photo.findUnique({ where: { id: photoId } }),
        ).toMatchObject({
          state: deletePhotos ? "DELETE_PENDING" : "READY",
          uploadedAt: expect.any(Date),
        });
        await service.uploadGallery(subject, image, "image/jpeg");
        await service.uploadGallery(subject, image, "image/jpeg");
        await expect(
          service.uploadGallery(subject, image, "image/jpeg"),
        ).rejects.toMatchObject({
          status: 409,
          message: "Daily photograph allowance reached",
        });
      },
    );
    it("post photo deletion denies a different owner without changing the post or photograph", async () => {
      const post = await service.createPhotoPost(
        actors[0].clerkId,
        image,
        "image/jpeg",
      );
      await expect(
        service.deletePost(actors[1].clerkId, post.id, true),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      expect(
        await db.photo.findUnique({ where: { id: post.photos[0].photo.id } }),
      ).toMatchObject({ state: "READY" });
    });
    it("post photo deletion rolls back the post when a photograph is retained by an archived Space", async () => {
      const subject = actors[0].clerkId;
      const post = await service.createPhotoPost(subject, image, "image/jpeg");
      const photoId = post.photos[0].photo.id;
      const room = await service.createSpace(subject, {
        kind: "PRIVATE",
        name: "Archived photographs",
      });
      await service.publish(subject, room.id, {
        body: "Retained",
        photoIds: [photoId],
      });
      await db.space.update({
        where: { id: room.id },
        data: { archivedAt: now },
      });
      await expect(
        service.deletePost(subject, post.id, true),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      expect(
        await db.galleryEntry.findUnique({ where: { photoId } }),
      ).not.toBeNull();
      expect(
        await db.photo.findUnique({ where: { id: photoId } }),
      ).toMatchObject({ state: "READY" });
    });

    it("reports the enforced personal allowance across posting, deletion, links and a new day", async () => {
      const subject = actors[0].clerkId;
      await expect(service.postingAllowance(subject)).resolves.toEqual({
        regularRemaining: 3,
        linkAllowed: true,
      });
      const post = await service.publishPersonal(subject, {
        body: "First thought",
        photoIds: [],
      });
      await service.publishPersonal(actors[1].clerkId, {
        body: "Someone else’s thought",
        photoIds: [],
      });
      await expect(service.postingAllowance(subject)).resolves.toEqual({
        regularRemaining: 2,
        linkAllowed: false,
      });
      await service.deletePost(subject, post.id);
      await expect(service.postingAllowance(subject)).resolves.toEqual({
        regularRemaining: 3,
        linkAllowed: true,
      });
      await service.publishPersonal(subject, {
        body: "A link https://example.com",
        photoIds: [],
      });
      await expect(service.postingAllowance(subject)).resolves.toEqual({
        regularRemaining: 0,
        linkAllowed: false,
      });
      now = new Date(now.getTime() + 86400000);
      await expect(service.postingAllowance(subject)).resolves.toEqual({
        regularRemaining: 3,
        linkAllowed: true,
      });
      await expect(
        service.postingAllowance(actors[3].clerkId),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("atomically publishes three personal uploads, retaining gallery references and enforcing the personal allowance", async () => {
      const subject = actors[0].clerkId;
      const files = Array.from({ length: 3 }, (_, index) => ({
        bytes: image,
        type: "image/jpeg",
        description: `Photograph ${index}`,
      }));
      const post = await service.publishPersonal(
        subject,
        { body: "A shared afternoon", photoIds: [] },
        files,
      );
      expect(await db.postPhoto.count({ where: { postId: post.id } })).toBe(3);
      expect(
        await db.galleryEntry.count({ where: { ownerId: actors[0].id } }),
      ).toBe(3);
      expect(
        (await service.profile(subject, actors[0].id)).posts[0].photos,
      ).toHaveLength(3);
      const reused = await db.postPhoto.findFirstOrThrow({
        where: { postId: post.id },
        select: { photoId: true },
      });
      await service.publishPersonal(subject, {
        body: "Second thought",
        photoIds: [reused.photoId],
      });
      expect(
        await db.galleryEntry.count({ where: { ownerId: actors[0].id } }),
      ).toBe(3);
      expect(await db.photo.count({ where: { ownerId: actors[0].id } })).toBe(
        3,
      );
      await service.publishPersonal(subject, {
        body: "Third thought",
        photoIds: [],
      });
      await expect(
        service.publishPersonal(subject, {
          body: "One too many",
          photoIds: [],
        }),
      ).rejects.toThrow("allowance");
      await expect(
        service.personalPhotos(actors[1].clerkId),
      ).resolves.toMatchObject({ photos: [] });
    });

    it("cleans every reserved upload and publishes nothing when one image fails normalization", async () => {
      const subject = actors[0].clerkId;
      await expect(
        service.publishPersonal(
          subject,
          { body: "Must be atomic", photoIds: [] },
          [
            { bytes: image, type: "image/jpeg", description: "Valid" },
            {
              bytes: new Uint8Array([0, 1, 2]),
              type: "image/jpeg",
              description: "Invalid",
            },
          ],
        ),
      ).rejects.toThrow();
      expect(await db.post.count({ where: { ownerId: actors[0].id } })).toBe(0);
      expect(
        await db.photo.count({
          where: { ownerId: actors[0].id, state: { in: ["READY", "PENDING"] } },
        }),
      ).toBe(0);
    });

    it("never removes an unrelated conversation while clearing a participant's history", async () => {
      await friends();
      const unrelated = await db.memberMessage.create({
        data: {
          senderId: actors[2].id,
          recipientId: actors[2].id,
          requestId: randomUUID(),
          body: "Independent retained row",
          hiddenBySender: true,
          hiddenByRecipient: true,
        },
      });
      await service.sendMessage(actors[0].clerkId, actors[1].id, {
        body: "Hello",
        requestId: randomUUID(),
      });
      await service.hideConversation(actors[0].clerkId, actors[1].id);
      expect(
        await db.memberMessage.findUnique({ where: { id: unrelated.id } }),
      ).not.toBeNull();
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).messages,
      ).toHaveLength(1);
    });

    it("exports only the caller's visible conversation and rejects third-party message reports", async () => {
      await friends();
      const message = await service.sendMessage(
        actors[0].clerkId,
        actors[1].id,
        { body: "Private hello", requestId: randomUUID() },
      );
      expect(
        JSON.stringify(
          await service.exportConversation(actors[0].clerkId, actors[1].id),
        ),
      ).toContain("Private hello");
      await expect(
        service.exportConversation(actors[2].clerkId, actors[1].id),
      ).rejects.toThrow();
      await expect(
        service.createReport(actors[2].clerkId, {
          target: {
            kind: "message",
            id: message.id,
            personId: actors[1].id,
            label: "Private conversation",
          },
          reason: "harassment",
          details: "",
        }),
      ).rejects.toThrow();
    });

    it("loads the real profile introduction and saves name/bio without accepting actor fields", async () => {
      const subject = actors[0].clerkId;
      await service.updateProfile(subject, {
        name: "Updated member",
        bio: "A saved bio",
      });
      const profile = await service.profile(subject, actors[0].id);
      expect(profile.profile).toMatchObject({
        name: "Updated member",
        bio: "A saved bio",
        relationship: "self",
      });
      expect(profile.viewer?.id).toBe(actors[0].id);
      expect(JSON.stringify(await service.identity(subject))).not.toContain(
        subject,
      );
      await expect(
        service.updateProfile(subject, {
          name: "Forged",
          bio: "",
          userId: actors[1].id,
        }),
      ).rejects.toThrow();
      await expect(
        service.updateProfile(actors[3].clerkId, { name: "Pending", bio: "" }),
      ).rejects.toThrow("not active");
    });
    it("preserves Space upload membership rules and cannot revive a removed Space photo through the personal library or Gallery", async () => {
      const subject = actors[0].clerkId;
      const space = await service.createSpace(subject, {
        kind: "PRIVATE",
        name: "Private test Space",
      });
      const files = [
        { bytes: image, type: "image/jpeg", description: "A private moment" },
      ];
      await expect(
        service.publishWithUploads(
          actors[1].clerkId,
          space.id,
          { body: "Forbidden", photoIds: [] },
          files,
        ),
      ).rejects.toThrow();
      expect(await db.photo.count({ where: { ownerId: actors[1].id } })).toBe(
        0,
      );
      const post = await service.publishWithUploads(
        subject,
        space.id,
        { body: "Shared here", photoIds: [] },
        files,
      );
      const [{ photo }] = (await service.readPost(subject, post.id)).photos;
      expect(
        await db.galleryEntry.count({ where: { ownerId: actors[0].id } }),
      ).toBe(0);
      expect(
        (await service.personalPhotos(subject)).photos.map((row) => row.id),
      ).toContain(photo.id);
      await expect(
        service.editPersonalPost(subject, post.id, "x".repeat(2001)),
      ).rejects.toThrow("2,000");
      await service.deleteSpace(subject, space.id);
      expect((await service.personalPhotos(subject)).photos).toEqual([]);
      await expect(
        service.arrangeGallery(subject, {
          version: 0,
          entries: [{ photoId: photo.id, featured: false }],
        }),
      ).rejects.toThrow();
      await expect(
        service.publishPersonal(subject, {
          body: "Revived",
          photoIds: [photo.id],
        }),
      ).rejects.toThrow();
    });
    it("persists preferences and rejects unknown security/role fields", async () => {
      await service.updatePreferences(actors[0].clerkId, {
        readingSize: "larger",
        motion: "reduced",
        notifyLikes: false,
      });
      expect(
        (await service.identity(actors[0].clerkId)).preferences,
      ).toMatchObject({
        readingSize: "larger",
        motion: "reduced",
        notifyLikes: false,
      });
      await expect(
        service.updatePreferences(actors[0].clerkId, { role: "FOUNDER" }),
      ).rejects.toThrow();
    });
    it("atomically claims usernames and enforces the one lifetime change per account", async () => {
      const username = `unique_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const outcomes = await Promise.allSettled([
        service.updateUsername(actors[0].clerkId, { username }),
        service.updateUsername(actors[1].clerkId, { username }),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const winner =
        (await service.identity(actors[0].clerkId)).username === username
          ? 0
          : 1;
      await expect(
        service.updateUsername(actors[winner].clerkId, {
          username: `next_${randomUUID().slice(0, 8)}`,
        }),
      ).rejects.toThrow("already been used");
      now = new Date(now.getTime() + 365 * 86400_000);
      await expect(
        service.updateUsername(actors[winner].clerkId, {
          username: `later_${randomUUID().slice(0, 8)}`,
        }),
      ).rejects.toThrow("already been used");
      await expect(
        service.updateUsername(actors[2].clerkId, { username: "admin" }),
      ).rejects.toThrow("unavailable");
    });
    it("allows only one of two simultaneous username changes for the same account", async () => {
      const results = await Promise.allSettled(
        ["first", "second"].map((prefix) =>
          service.updateUsername(actors[0].clerkId, {
            username: `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        (await service.identity(actors[0].clerkId)).usernameChangedAt,
      ).not.toBeNull();
    });
    it("uploads Gallery photographs without publishing a personal post, sharing the real daily allowance", async () => {
      const subject = actors[0].clerkId;
      for (let i = 0; i < 3; i++)
        await service.uploadGallery(subject, image, "image/jpeg", `River ${i}`);
      expect(await db.post.count({ where: { ownerId: actors[0].id } })).toBe(0);
      expect(
        (await service.profile(subject, actors[0].id)).gallery,
      ).toHaveLength(3);
      await expect(
        service.uploadGallery(subject, image, "image/jpeg", "Fourth"),
      ).rejects.toThrow("allowance");
    });
    it("limits profile introductions to a crop while keeping the original private", async () => {
      const photo = await service.uploadGallery(
        actors[0].clerkId,
        image,
        "image/jpeg",
        "Landscape",
      );
      await service.setPortrait(actors[0].clerkId, photo.id);
      const crop = await service.portrait(actors[1].clerkId, actors[0].id);
      expect(await sharp(crop).metadata()).toMatchObject({
        width: 208,
        height: 208,
      });
      await expect(
        service.readPhoto(actors[1].clerkId, photo.id),
      ).rejects.toThrow();
      await expect(
        service.setPortrait(actors[1].clerkId, photo.id),
      ).rejects.toThrow();
      await service.relationship(actors[0].clerkId, actors[1].id, "block");
      await expect(
        service.portrait(actors[1].clerkId, actors[0].id),
      ).rejects.toThrow();
    });
    it("serializes gallery arrangements, checks ownership and rejects a stale editor", async () => {
      const subject = actors[0].clerkId;
      const photo = await service.uploadGallery(
        subject,
        image,
        "image/jpeg",
        "River",
      );
      const version = (await service.identity(subject)).galleryVersion;
      await service.arrangeGallery(subject, {
        version,
        entries: [{ photoId: photo.id, featured: true }],
      });
      expect(
        (await service.profile(subject, actors[0].id)).gallery[0].featured,
      ).toBe(true);
      await expect(
        service.arrangeGallery(subject, { version, entries: [] }),
      ).rejects.toThrow("changed");
      await expect(
        service.arrangeGallery(actors[1].clerkId, {
          version: 0,
          entries: [{ photoId: photo.id, featured: true }],
        }),
      ).rejects.toThrow();
    });
    it("restricts post, gallery and music content to the current audience", async () => {
      await service.createPost(actors[0].clerkId, "Private update");
      await service.music(actors[0].clerkId, {
        action: "add",
        trackId: track.id,
      });
      const stranger = await service.profile(actors[1].clerkId, actors[0].id);
      expect(stranger.profile.bio).toBe("Saved introduction");
      expect(stranger.posts).toEqual([]);
      expect(stranger.profile.onRepeat).toEqual([]);
      await friends();
      expect(
        (await service.profile(actors[1].clerkId, actors[0].id)).profile
          .onRepeat?.[0].id,
      ).toBe(track.id);
      expect(
        (await service.profile(actors[1].clerkId, actors[0].id)).posts[0].body,
      ).toBe("Private update");
    });
    it("reports the current friendship’s acceptance date to both friends, preserving it on read and resetting it after re-friending", async () => {
      const since = now.toISOString();
      await friends();
      const contact = async (actor: number, friend: number) =>
        (await service.contacts(actors[actor].clerkId)).contacts.find(
          (row) => row.person.id === actors[friend].id,
        );
      expect((await contact(0, 1))?.friendsSince).toBe(since);
      expect((await contact(1, 0))?.friendsSince).toBe(since);
      await service.readNotifications(actors[0].clerkId);
      now = new Date(now.getTime() + 3600000);
      await service.relationship(actors[1].clerkId, actors[0].id, "accept");
      expect((await contact(0, 1))?.friendsSince).toBe(since);
      await service.relationship(actors[0].clerkId, actors[1].id, "remove");
      await service.relationship(actors[0].clerkId, actors[1].id, "request");
      expect((await contact(0, 1))?.friendsSince).toBeNull();
      await service.relationship(actors[1].clerkId, actors[0].id, "accept");
      expect((await contact(0, 1))?.friendsSince).toBe(now.toISOString());
      await db.memberNotification.deleteMany({
        where: { kind: "friend_accepted" },
      });
      expect((await contact(0, 1))?.friendsSince).toBeNull();
    });
    it("searches actual active introductions without disclosing pending or blocked accounts", async () => {
      expect(
        (
          await service.contacts(actors[0].clerkId, "Saved member")
        ).contacts.map((row) => row.person.id),
      ).toEqual(expect.arrayContaining([actors[1].id, actors[2].id]));
      expect(
        (
          await service.contacts(actors[0].clerkId, "Saved member")
        ).contacts.map((row) => row.person.id),
      ).not.toContain(actors[3].id);
      await service.relationship(actors[0].clerkId, actors[1].id, "block");
      expect(
        (
          await service.contacts(actors[0].clerkId, "Saved member")
        ).contacts.map((row) => row.person.id),
      ).not.toContain(actors[1].id);
    });
    it("sends messages only between friends and deduplicates uncertain retries", async () => {
      const input = {
        body: "Hello from a real member",
        requestId: randomUUID(),
      };
      await expect(
        service.sendMessage(actors[0].clerkId, actors[1].id, input),
      ).rejects.toThrow();
      await friends();
      const first = await service.sendMessage(
        actors[0].clerkId,
        actors[1].id,
        input,
      );
      expect(
        await service.sendMessage(actors[0].clerkId, actors[1].id, input),
      ).toEqual(first);
      await expect(
        service.sendMessage(actors[0].clerkId, actors[1].id, {
          ...input,
          body: "Another body",
        }),
      ).rejects.toThrow("already used");
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).messages,
      ).toHaveLength(1);
      await expect(
        service.conversation(actors[2].clerkId, actors[0].id),
      ).rejects.toThrow();
    });
    it("preserves participant history after unfriending, while denying new messages", async () => {
      await friends();
      await service.sendMessage(actors[0].clerkId, actors[1].id, {
        body: "Saved history",
        requestId: randomUUID(),
      });
      await service.relationship(actors[0].clerkId, actors[1].id, "remove");
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).thread
          .canSend,
      ).toBe(false);
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id))
          .messages[0].body,
      ).toBe("Saved history");
      await expect(
        service.sendMessage(actors[0].clerkId, actors[1].id, {
          body: "Denied",
          requestId: randomUUID(),
        }),
      ).rejects.toThrow();
    });
    it("keeps Notebook notes self-addressed and hides only the requesting participant's conversation", async () => {
      const note = await service.sendMessage(actors[0].clerkId, actors[0].id, {
        body: "My note",
        requestId: randomUUID(),
      });
      expect(
        (await service.conversation(actors[0].clerkId, actors[0].id))
          .messages[0].id,
      ).toBe(note.id);
      await expect(
        service.conversation(actors[1].clerkId, actors[0].id),
      ).rejects.toThrow();
      await friends();
      await service.sendMessage(actors[0].clerkId, actors[1].id, {
        body: "A shared message",
        requestId: randomUUID(),
      });
      await service.hideConversation(actors[0].clerkId, actors[1].id);
      expect(
        (await service.conversation(actors[0].clerkId, actors[1].id)).messages,
      ).toEqual([]);
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).messages,
      ).toHaveLength(1);
    });
    it("marks messages read only through a visible anchor in this participant's thread", async () => {
      await friends();
      const sent = await service.sendMessage(actors[0].clerkId, actors[1].id, {
        body: "Unread",
        requestId: randomUUID(),
      });
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).thread
          .unread,
      ).toBe(true);
      await expect(
        service.readConversation(actors[1].clerkId, actors[0].id, "foreign-id"),
      ).rejects.toThrow();
      await service.readConversation(actors[1].clerkId, actors[0].id, sent.id);
      expect(
        (await service.conversation(actors[1].clerkId, actors[0].id)).thread
          .unread,
      ).toBe(false);
    });
    it("persists likes and notifications idempotently, hiding activity after access changes", async () => {
      await friends();
      const post = await service.createPost(
        actors[0].clerkId,
        "A little update",
      );
      expect(await service.like(actors[1].clerkId, post.id, true)).toEqual({
        liked: true,
        count: 1,
      });
      expect(
        (await service.identity(actors[0].clerkId)).preferences.notifyLikes,
      ).toBe(false);
      expect(
        (await service.notifications(actors[0].clerkId)).activity.some(
          (row) => row.kind === "like",
        ),
      ).toBe(false);
      await service.updatePreferences(actors[0].clerkId, { notifyLikes: true });
      expect(await service.like(actors[1].clerkId, post.id, true)).toEqual({
        liked: true,
        count: 1,
      });
      const activity = (
        await service.notifications(actors[0].clerkId)
      ).activity.find((row) => row.kind === "like")!;
      expect(activity).toBeDefined();
      await service.readNotifications(actors[2].clerkId, activity.id);
      expect(
        (await service.notifications(actors[0].clerkId)).activity.find(
          (row) => row.id === activity.id,
        )?.read,
      ).toBe(false);
      await service.readNotifications(actors[0].clerkId, activity.id);
      expect(
        (await service.notifications(actors[0].clerkId)).activity.find(
          (row) => row.id === activity.id,
        )?.read,
      ).toBe(true);
      await service.relationship(actors[0].clerkId, actors[1].id, "block");
      expect((await service.notifications(actors[0].clerkId)).activity).toEqual(
        [],
      );
      await expect(
        service.like(actors[1].clerkId, post.id, false),
      ).rejects.toThrow();
    });
    it("edits only owned posts while preserving expiration and daily link limits", async () => {
      const post = await service.createPost(actors[0].clerkId, "Before");
      now = new Date(now.getTime() + 8 * 86400_000);
      await service.editPersonalPost(actors[0].clerkId, post.id, "After");
      const saved = await service.readPost(actors[0].clerkId, post.id);
      expect(saved.body).toBe("After");
      expect(saved.expiresAt).toEqual(post.expiresAt);
      expect(saved.createdAt).toEqual(post.createdAt);
      now = post.createdAt;
      await expect(
        service.editPersonalPost(actors[1].clerkId, post.id, "Forged"),
      ).rejects.toThrow();
      await service.createPost(actors[0].clerkId, "A second thought");
      await expect(
        service.editPersonalPost(
          actors[0].clerkId,
          post.id,
          "https://example.com",
        ),
      ).rejects.toThrow("allowance");
    });
    it("exports only the current account's records and removes message access on deactivation", async () => {
      const note = await service.sendMessage(actors[0].clerkId, actors[0].id, {
        body: "Private note",
        requestId: randomUUID(),
      });
      const data = await service.exportAccount(actors[0].clerkId);
      expect(data.messages[0].id).toBe(note.id);
      expect(JSON.stringify(data)).not.toMatch(
        /objectKey|clerkId|password|sessionId/,
      );
      await service.deactivate(actors[0].clerkId);
      await expect(service.identity(actors[0].clerkId)).rejects.toThrow(
        "not active",
      );
      expect(
        await db.memberMessage.count({ where: { senderId: actors[0].id } }),
      ).toBe(0);
    });
    it("paginates a participant's messages without overlap and rejects a cursor from another thread", async () => {
      const actor = actors[0];
      await db.memberMessage.createMany({
        data: Array.from({ length: 61 }, (_, index) => ({
          senderId: actor.id,
          recipientId: actor.id,
          requestId: randomUUID(),
          body: `Note ${index}`,
          createdAt: new Date(now.getTime() + index),
        })),
      });
      const first = await service.conversation(actor.clerkId, actor.id);
      expect(first.messages).toHaveLength(50);
      expect(first.nextCursor).not.toBeNull();
      const older = await service.conversation(
        actor.clerkId,
        actor.id,
        first.nextCursor!,
      );
      expect(older.messages).toHaveLength(11);
      expect(
        new Set(
          [...older.messages, ...first.messages].map((message) => message.id),
        ).size,
      ).toBe(61);
      const foreign = await service.sendMessage(
        actors[2].clerkId,
        actors[2].id,
        { body: "Foreign note", requestId: randomUUID() },
      );
      await expect(
        service.conversation(actor.clerkId, actor.id, foreign.id),
      ).rejects.toThrow();
    });
    it("edits private details independently and keeps RSVP responses while admins turn RSVPs off", async () => {
      await friends();
      const owner = actors[0];
      const member = actors[1];
      const planned = {
        kind: "PRIVATE" as const,
        name: "Our plans",
        startsAt: "2027-01-01T09:00:00Z",
        endsAt: "2027-01-01T11:00:00Z",
        timeZone: "Asia/Tokyo",
        location: "At home",
        rsvpEnabled: true,
      };
      const room = await service.createSpace(owner.clerkId, planned);
      await service.accept(
        member.clerkId,
        (await service.invite(owner.clerkId, room.id, member.id)).id,
      );
      await service.member(member.clerkId, room.id, {
        action: "rsvp",
        rsvp: "GOING",
      });
      await expect(
        service.updateSpace(member.clerkId, room.id, planned),
      ).rejects.toMatchObject({ status: 403 });
      const changed = {
        ...planned,
        startsAt: "2027-01-02T09:00:00Z",
        endsAt: "2027-01-02T12:00:00Z",
        location: "",
        rsvpEnabled: false,
      };
      await service.updateSpace(owner.clerkId, room.id, changed);
      const off = await service.readSpace(member.clerkId, room.id);
      expect(off).toMatchObject({
        startsAt: "2027-01-02T09:00:00.000Z",
        endsAt: "2027-01-02T12:00:00.000Z",
        location: null,
        rsvpEnabled: false,
        rsvp: null,
        expiresAt: null,
      });
      expect(off.members.every((entry) => entry.rsvp === null)).toBe(true);
      expect(
        (
          await db.spaceMembership.findUniqueOrThrow({
            where: { spaceId_userId: { spaceId: room.id, userId: member.id } },
          })
        ).rsvp,
      ).toBe("GOING");
      await expect(
        service.member(member.clerkId, room.id, {
          action: "rsvp",
          rsvp: "MAYBE",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.member(member.clerkId, room.id, {
          action: "rsvp-settings",
          rsvpEnabled: true,
        }),
      ).rejects.toMatchObject({ status: 403 });
      await service.member(owner.clerkId, room.id, {
        action: "rsvp-settings",
        rsvpEnabled: true,
      });
      expect((await service.readSpace(member.clerkId, room.id)).rsvp).toBe(
        "GOING",
      );
      await expect(
        service.updateSpace(owner.clerkId, room.id, {
          ...changed,
          endsAt: changed.startsAt,
        }),
      ).rejects.toThrow();
      await service.updateSpace(owner.clerkId, room.id, {
        kind: "PRIVATE",
        name: "Just a place",
        location: "The library",
      });
      expect(await service.readSpace(member.clerkId, room.id)).toMatchObject({
        startsAt: null,
        endsAt: null,
        location: "The library",
        rsvp: null,
      });
    });
    it("excludes your own opted-in Space posts from the main feed while retaining the Space timeline and other members’ posts", async () => {
      await friends();
      const room = await service.createSpace(actors[0].clerkId, {
        kind: "PRIVATE",
        name: "Shared room",
      });
      await service.accept(
        actors[1].clerkId,
        (await service.invite(actors[0].clerkId, room.id, actors[1].id)).id,
      );
      for (const actor of actors.slice(0, 2)) {
        await service.member(actor.clerkId, room.id, {
          action: "preferences",
          includeInFeed: true,
        });
      }
      const own = await service.publish(actors[0].clerkId, room.id, {
        body: "My Space post",
        photoIds: [],
      });
      now = new Date(now.getTime() + 1000);
      const other = await service.publish(actors[1].clerkId, room.id, {
        body: "Another member’s Space post",
        photoIds: [],
      });
      now = new Date(now.getTime() + 1000);
      const personal = await service.publishPersonal(actors[1].clerkId, {
        body: "Their personal post",
        photoIds: [],
      });
      expect(
        (await service.feed(actors[0].clerkId)).posts.map((post) => post.id),
      ).toEqual([personal.id, other.id]);
      expect(
        (await service.feed(actors[1].clerkId)).posts.map((post) => post.id),
      ).toEqual([own.id]);
      expect(
        (await service.posts(actors[0].clerkId, room.id)).posts.map(
          (post) => post.id,
        ),
      ).toEqual([other.id, own.id]);
    });
    it("uses the saved protected portrait across Feed and conversation authors", async () => {
      await friends();
      const subject = actors[0].clerkId;
      const photo = await service.uploadGallery(
        subject,
        image,
        "image/jpeg",
        "Member portrait",
      );
      await service.setPortrait(subject, photo.id);
      const post = await service.publishPersonal(subject, {
        body: "A thought",
        photoIds: [],
      });
      await service.comment(subject, post.id, { body: "A conversation" });
      const expected = `/api/profiles/${actors[0].id}/portrait?v=${photo.id}`;
      expect(
        (await service.feed(actors[1].clerkId)).posts[0].author.photo?.src,
      ).toBe(expected);
      expect(
        (await service.comments(actors[1].clerkId, post.id)).comments[0].author
          .photo?.src,
      ).toBe(expected);
    });
  },
);
