import "server-only";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  containsPostLink,
  DAILY_IMAGES,
  DAILY_REGULAR_POSTS,
} from "@/lib/platform-rules";
import { dayKey } from "@/features/feed/format";
import { SocialError, unavailable } from "./errors";
import { normalizePhoto, type PrivatePhotoStore } from "./photo";
import type { ReportInput } from "@/features/safety/model";

type Tx = Prisma.TransactionClient;
const active = { account: { is: { status: "ACTIVE" as const } } };
const pair = (a: string, b: string) =>
  a < b ? { lowId: a, highId: b } : { lowId: b, highId: a };
const postSelect = {
  id: true,
  ownerId: true,
  body: true,
  createdAt: true,
  expiresAt: true,
  photos: {
    where: { photo: { state: "READY" as const } },
    select: {
      photo: {
        select: { id: true, description: true, width: true, height: true },
      },
    },
  },
} satisfies Prisma.PostSelect;

/** Server-only DAL. subject must come from a verified provider session, never a request field. */
export class SocialService {
  constructor(
    private readonly db: PrismaClient,
    private readonly store: PrivatePhotoStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(run, {
          isolationLevel: "Serializable",
          timeout: 20_000,
        });
      } catch (error) {
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" ||
            (error.code === "P2010" &&
              ["40001", "40P01"].includes(String(error.meta?.code))));
        if (conflict && attempt < 5) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              10 * 2 ** attempt + Math.floor(Math.random() * 10),
            ),
          );
          continue;
        }
        if (conflict)
          throw new SocialError(409, "Concurrent change; retry the request");
        throw error;
      }
    }
  }
  private async actor(tx: Tx, subject: string) {
    if (!subject) throw new SocialError(401, "Authentication required");
    const user = await tx.user.findUnique({
      where: { clerkId: subject },
      select: { id: true, account: { select: { status: true } } },
    });
    if (!user || user.account?.status !== "ACTIVE")
      throw new SocialError(403, "Account is not active");
    return user.id;
  }
  private async lock(tx: Tx, ids: string[]) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id FOR UPDATE`,
    );
  }
  private async blocked(tx: Tx, a: string, b: string) {
    return !!(await tx.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { blockerId: true },
    }));
  }
  private async audience(tx: Tx, viewer: string, owner: string) {
    if (
      !(await tx.user.findFirst({
        where: { id: owner, ...active },
        select: { id: true },
      }))
    )
      throw unavailable();
    if (viewer === owner) return;
    if (await this.blocked(tx, viewer, owner)) throw unavailable();
    const friendship = await tx.friendship.findUnique({
      where: { lowId_highId: pair(viewer, owner) },
    });
    if (friendship?.status !== "ACCEPTED") throw unavailable();
  }
  private async quota(tx: Tx, ownerId: string, hasLink: boolean, now: Date) {
    const posts = await tx.post.findMany({
      where: { ownerId, dayKey: dayKey(now.toISOString()), deletedAt: null },
      select: { hasLink: true },
    });
    if (
      (hasLink && posts.length) ||
      posts.some((p) => p.hasLink) ||
      posts.length >= DAILY_REGULAR_POSTS
    )
      throw new SocialError(409, "Daily post allowance reached");
  }
  private postData(ownerId: string, body: string, now: Date) {
    return {
      ownerId,
      body,
      hasLink: containsPostLink({ body }),
      dayKey: dayKey(now.toISOString()),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };
  }
  async account(subject: string) {
    if (!subject) throw new SocialError(401, "Authentication required");
    // No implicit activation or preview-actor fallback. Activation is operator controlled.
    const user = await this.db.user.findUnique({
      where: { clerkId: subject },
      select: { id: true, account: { select: { status: true } } },
    });
    return user
      ? { id: user.id, accountStatus: user.account?.status ?? "PENDING" }
      : null;
  }
  async createInvitation(subject: string) {
    if (process.env.MARGIN_REGISTRATION_ENABLED !== "1")
      throw new SocialError(503, "Invitations are not open");
    return this.transaction(async (tx) => {
      const owner = await this.actor(tx, subject);
      const granted = await tx.account.updateMany({
        where: {
          userId: owner,
          status: "ACTIVE",
          invitationsRemaining: { gt: 0 },
        },
        data: { invitationsRemaining: { decrement: 1 } },
      });
      if (granted.count !== 1)
        throw new SocialError(
          409,
          "You have no invitations available right now.",
        );
      const code = randomBytes(32).toString("base64url");
      const expiresAt = new Date(this.clock().getTime() + 7 * 86400_000);
      await tx.invitation.create({
        data: {
          digest: createHash("sha256").update(code).digest("hex"),
          expiresAt,
          createdBy: owner,
        },
      });
      return { code, expiresAt };
    });
  }
  async createReport(subject: string, input: ReportInput) {
    if (input.target.kind !== "profile" && input.target.kind !== "post")
      throw new SocialError(
        400,
        "This report type is not connected to the live service yet.",
      );
    return this.transaction(async (tx) => {
      const reporter = await this.actor(tx, subject);
      let targetPersonId = input.target.personId;
      if (input.target.kind === "post") {
        const post = await tx.post.findUnique({
          where: { id: input.target.id },
          select: { ownerId: true, deletedAt: true, expiresAt: true },
        });
        if (!post || post.deletedAt || post.expiresAt <= this.clock())
          throw unavailable();
        await this.audience(tx, reporter, post.ownerId);
        targetPersonId = post.ownerId;
        if (targetPersonId !== input.target.personId) throw unavailable();
      } else if (
        input.target.id !== targetPersonId ||
        !(await tx.user.findUnique({
          where: { id: targetPersonId },
          select: { id: true },
        }))
      )
        throw unavailable();
      if (targetPersonId === reporter)
        throw new SocialError(400, "Choose another account.");
      const report = await tx.safetyReport.create({
        data: {
          reporterId: reporter,
          targetKind: input.target.kind,
          targetId: input.target.id,
          targetPersonId,
          reason: input.reason,
          details: input.details,
        },
        select: { id: true, status: true, createdAt: true },
      });
      return report;
    });
  }
  async relationship(
    subject: string,
    targetId: string,
    action: "request" | "accept" | "remove" | "block" | "unblock",
  ) {
    return this.transaction(async (tx) => {
      const actorId = await this.actor(tx, subject);
      if (actorId === targetId)
        throw new SocialError(400, "Choose another account");
      await this.lock(tx, [actorId, targetId]);
      if (
        !(await tx.user.findFirst({
          where: { id: targetId, ...active },
          select: { id: true },
        }))
      )
        throw unavailable();
      const key = pair(actorId, targetId);
      if (action === "block") {
        await tx.friendship.deleteMany({ where: key });
        await tx.block.upsert({
          where: {
            blockerId_blockedId: { blockerId: actorId, blockedId: targetId },
          },
          create: { blockerId: actorId, blockedId: targetId },
          update: {},
        });
      } else if (action === "unblock") {
        await tx.block.deleteMany({
          where: { blockerId: actorId, blockedId: targetId },
        });
      } else if (action === "remove") {
        await tx.friendship.deleteMany({ where: key });
      } else {
        if (await this.blocked(tx, actorId, targetId)) throw unavailable();
        const existing = await tx.friendship.findUnique({
          where: { lowId_highId: key },
        });
        if (action === "accept") {
          if (!existing || existing.requesterId === actorId)
            throw new SocialError(409, "No incoming request");
          await tx.friendship.update({
            where: { lowId_highId: key },
            data: { status: "ACCEPTED" },
          });
        } else if (!existing)
          await tx.friendship.create({
            data: { ...key, requesterId: actorId },
          });
      }
    });
  }
  async createPost(subject: string, body: string) {
    return this.transaction(async (tx) => {
      const actorId = await this.actor(tx, subject);
      await this.lock(tx, [actorId]);
      const now = this.clock();
      const data = this.postData(actorId, body, now);
      await this.quota(tx, actorId, data.hasLink, now);
      return tx.post.create({ data, select: postSelect });
    });
  }
  async createPhotoPost(
    subject: string,
    bytes: Uint8Array,
    type: string,
    description: string,
  ) {
    // Authenticate and reserve BEFORE decoding/storage. Pending reservations expire after 10 min.
    const reservation = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const now = this.clock();
      await this.quota(tx, ownerId, false, now);
      const reserved = {
        ownerId,
        OR: [
          { state: "READY" as const },
          { state: "PENDING" as const, uploadExpiresAt: { gt: now } },
        ],
      };
      if (
        (await tx.photo.count({
          where: { ...reserved, dayKey: dayKey(now.toISOString()) },
        })) >= DAILY_IMAGES
      )
        throw new SocialError(409, "Daily photograph allowance reached");
      const slots =
        (await tx.galleryEntry.count({ where: { ownerId } })) +
        (await tx.photo.count({
          where: { ownerId, state: "PENDING", uploadExpiresAt: { gt: now } },
        }));
      if (slots >= 20) throw new SocialError(409, "Gallery is full");
      return tx.photo.create({
        data: {
          ownerId,
          objectKey: `social/${randomUUID()}.webp`,
          dayKey: dayKey(now.toISOString()),
          createdAt: now,
          uploadExpiresAt: new Date(now.getTime() + 600_000),
          description,
          width: 1,
          height: 1,
          byteLength: 1,
        },
      });
    });
    try {
      const photo = await normalizePhoto(bytes, type);
      await this.store.put(reservation.objectKey, photo.bytes);
      return await this.transaction(async (tx) => {
        const actorId = await this.actor(tx, subject);
        await this.lock(tx, [actorId]);
        const now = this.clock();
        const pending = await tx.photo.findUniqueOrThrow({
          where: { id: reservation.id },
        });
        if (
          pending.state !== "PENDING" ||
          pending.uploadExpiresAt <= now ||
          pending.dayKey !== dayKey(now.toISOString())
        )
          throw new SocialError(409, "Upload expired; try again");
        await this.quota(tx, actorId, false, now);
        await tx.photo.update({
          where: { id: pending.id },
          data: {
            state: "READY",
            width: photo.width,
            height: photo.height,
            byteLength: photo.byteLength,
          },
        });
        await tx.galleryEntry.create({
          data: { ownerId: actorId, photoId: pending.id },
        });
        return tx.post.create({
          data: {
            ...this.postData(actorId, "", now),
            photos: { create: { photoId: pending.id } },
          },
          select: postSelect,
        });
      });
    } catch (error) {
      await this.db.photo.updateMany({
        where: { id: reservation.id, state: { not: "READY" } },
        data: { state: "DELETE_PENDING" },
      });
      throw error;
    }
  }
  async readPost(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actorId = await this.actor(tx, subject);
      const post = await tx.post.findFirst({
        where: { id, deletedAt: null, expiresAt: { gt: this.clock() } },
        select: postSelect,
      });
      if (!post) throw unavailable();
      await this.lock(tx, [actorId, post.ownerId]);
      await this.audience(tx, actorId, post.ownerId);
      return post;
    });
  }
  async readPhoto(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actorId = await this.actor(tx, subject);
      const photo = await tx.photo.findFirst({
        where: { id, state: "READY" },
        select: {
          ownerId: true,
          objectKey: true,
          gallery: { select: { photoId: true } },
          posts: {
            where: {
              post: { deletedAt: null, expiresAt: { gt: this.clock() } },
            },
            take: 1,
            select: { postId: true },
          },
        },
      });
      if (!photo || (!photo.gallery && !photo.posts.length))
        throw unavailable();
      await this.lock(tx, [actorId, photo.ownerId]);
      await this.audience(tx, actorId, photo.ownerId);
      // Authorization and byte retrieval share the transaction; no reusable bearer URLs.
      return this.store.get(photo.objectKey);
    });
  }
  async deletePost(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const post = await tx.post.findFirst({
        where: { id, ownerId },
        select: { id: true },
      });
      if (!post) throw unavailable();
      await tx.post.update({
        where: { id },
        data: { deletedAt: this.clock(), body: "" },
      });
      await tx.postPhoto.deleteMany({ where: { postId: id } });
      // Gallery references deliberately survive deleting a post.
    });
  }
  async deletePhoto(subject: string, id: string) {
    const objectKey = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const photo = await tx.photo.findFirst({
        where: { id, ownerId },
        select: { id: true, objectKey: true, state: true },
      });
      if (!photo) throw unavailable();
      if (photo.state === "PURGED") return null;
      await tx.photo.update({
        where: { id },
        data: { state: "DELETE_PENDING" },
      });
      await tx.galleryEntry.deleteMany({ where: { photoId: id } });
      await tx.postPhoto.deleteMany({ where: { photoId: id } });
      return photo.objectKey;
    });
    if (objectKey) {
      // Denial is committed first. An outage leaves a durable retry tombstone.
      await this.store.delete(objectKey);
      await this.db.photo.updateMany({
        where: { id, state: "DELETE_PENDING" },
        data: { state: "PURGED", description: "" },
      });
    }
  }
  async deactivate(subject: string) {
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      await tx.account.update({
        where: { userId: id },
        data: { status: "DEACTIVATED" },
      });
      await tx.friendship.deleteMany({
        where: { OR: [{ lowId: id }, { highId: id }] },
      });
      await tx.post.updateMany({
        where: { ownerId: id },
        data: { deletedAt: this.clock(), body: "" },
      });
      await tx.photo.updateMany({
        where: { ownerId: id, state: { not: "PURGED" } },
        data: { state: "DELETE_PENDING" },
      });
      await tx.galleryEntry.deleteMany({ where: { ownerId: id } });
    });
  }
  /** Trusted maintenance call only; no public job endpoint. Retry-safe after object-store failures. */
  async purgeDeletedPhotos(limit = 20) {
    const eligible = {
      OR: [
        { state: "DELETE_PENDING" as const },
        { state: "PENDING" as const, uploadExpiresAt: { lte: this.clock() } },
      ],
    };
    const rows = await this.db.photo.findMany({
      where: eligible,
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true, objectKey: true },
    });
    let purged = 0;
    for (const row of rows) {
      await this.db.photo.updateMany({
        where: { id: row.id, ...eligible },
        data: { state: "DELETE_PENDING" },
      });
      await this.store.delete(row.objectKey);
      await this.db.photo.updateMany({
        where: { id: row.id, state: "DELETE_PENDING" },
        data: { state: "PURGED", description: "" },
      });
      purged++;
    }
    return purged;
  }
  /** Access expires synchronously; this bounded job erases expired text/references later. */
  async expirePosts(limit = 20) {
    const expired = await this.db.post.findMany({
      where: { deletedAt: null, expiresAt: { lte: this.clock() } },
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true, ownerId: true },
    });
    for (const post of expired)
      await this.transaction(async (tx) => {
        await this.lock(tx, [post.ownerId]);
        await tx.post.updateMany({
          where: {
            id: post.id,
            deletedAt: null,
            expiresAt: { lte: this.clock() },
          },
          data: { deletedAt: this.clock(), body: "" },
        });
        await tx.postPhoto.deleteMany({ where: { postId: post.id } });
      });
    return expired.length;
  }
}
