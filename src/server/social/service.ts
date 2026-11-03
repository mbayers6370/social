import "server-only";
import { memberPerson } from "@/lib/member-person";
import { profileTrackFromRow } from "@/server/music/selections";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  containsPostLink,
  DAILY_IMAGES,
  DAILY_REGULAR_POSTS,
  SPACE_PHOTO_LIMIT,
} from "@/lib/platform-rules";
import { dayKey } from "@/features/feed/format";
import { SocialError, unavailable } from "./errors";
import { normalizePhoto, type PrivatePhotoStore } from "./photo";
import type { ReportInput } from "@/features/safety/model";
import {
  releaseSpacePhotoReferences,
  retireUnreferencedPhotos,
} from "@/server/spaces/media-lifecycle";
import { spaceAccess, liveSpaceWhere } from "@/server/spaces/access";
import { notifySpacePost } from "@/server/spaces/post-notifications";
import type { PrivateProfileData } from "@/features/social/contracts";

type Tx = Prisma.TransactionClient;
const active = { account: { is: { status: "ACTIVE" as const } } };
const pair = (a: string, b: string) =>
  a < b ? { lowId: a, highId: b } : { lowId: b, highId: a };
const postSelect = {
  id: true,
  ownerId: true,
  spaceId: true,
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
    protected readonly db: PrismaClient,
    protected readonly store: PrivatePhotoStore,
    protected readonly clock: () => Date = () => new Date(),
  ) {}

  protected async notify(
    tx: Tx,
    recipientId: string,
    actorId: string,
    kind:
      | "friend_request"
      | "friend_accepted"
      | "comment"
      | "reply"
      | "like"
      | "message"
      | "space_post"
      | "space_invitation",
    dedupeKey: string,
    postId?: string,
  ) {
    if (recipientId === actorId) return;
    await tx.memberNotification.upsert({
      where: { dedupeKey },
      create: {
        recipientId,
        actorId,
        kind,
        dedupeKey,
        postId,
        createdAt: this.clock(),
      },
      update: {},
    });
  }

  protected async transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(run, {
          isolationLevel: "Serializable",
          timeout: 20_000,
        });
      } catch (error) {
        const known = error instanceof Prisma.PrismaClientKnownRequestError;
        const adapter = known ? error.meta?.driverAdapterError : undefined;
        const cause =
          typeof adapter === "object" && adapter !== null && "cause" in adapter
            ? adapter.cause
            : undefined;
        const driverConflict =
          typeof cause === "object" &&
          cause !== null &&
          "kind" in cause &&
          cause.kind === "TransactionWriteConflict";
        const conflict =
          known &&
          (error.code === "P2034" ||
            (error.code === "P2010" &&
              (driverConflict ||
                ["40001", "40P01"].includes(String(error.meta?.code)))));
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
  protected async actor(tx: Tx, subject: string) {
    if (!subject) throw new SocialError(401, "Authentication required");
    const user = await tx.user.findUnique({
      where: { clerkId: subject },
      select: { id: true, account: { select: { status: true } } },
    });
    if (!user || user.account?.status !== "ACTIVE")
      throw new SocialError(403, "Account is not active");
    return user.id;
  }
  protected async lock(tx: Tx, ids: string[]) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id FOR UPDATE`,
    );
  }
  protected async blocked(tx: Tx, a: string, b: string) {
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
  protected async audience(tx: Tx, viewer: string, owner: string) {
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
  protected async postAudience(
    tx: Tx,
    viewer: string,
    post: { ownerId: string; spaceId: string | null },
    write = false,
  ) {
    if (post.spaceId) {
      await spaceAccess(tx, viewer, post.spaceId, write, this.clock());
      if (
        !(await tx.user.findFirst({
          where: { id: post.ownerId, account: { is: { status: "ACTIVE" } } },
          select: { id: true },
        }))
      )
        throw unavailable();
      if (await this.blocked(tx, viewer, post.ownerId)) throw unavailable();
    } else await this.audience(tx, viewer, post.ownerId);
  }
  protected async photoAudience(tx: Tx, viewer: string, id: string) {
    const photo = await tx.photo.findFirst({
      where: {
        id,
        state: "READY",
        owner: { account: { is: { status: "ACTIVE" } } },
      },
      select: {
        id: true,
        ownerId: true,
        objectKey: true,
        gallery: { select: { photoId: true } },
      },
    });
    if (!photo || (await this.blocked(tx, viewer, photo.ownerId)))
      throw unavailable();
    await this.lock(tx, [viewer, photo.ownerId]);
    if (
      viewer === photo.ownerId &&
      (await tx.account.findFirst({
        where: { userId: viewer, portraitPhotoId: id },
        select: { userId: true },
      }))
    )
      return photo;
    const personal =
      photo.gallery ||
      (await tx.postPhoto.findFirst({
        where: {
          photoId: id,
          post: {
            spaceId: null,
            deletedAt: null,
            expiresAt: { gt: this.clock() },
          },
        },
        select: { postId: true },
      }));
    if (personal) {
      try {
        await this.audience(tx, viewer, photo.ownerId);
        return photo;
      } catch (error) {
        if (!(error instanceof SocialError) || error.status !== 404)
          throw error;
      }
    }
    const reference = await tx.post.findFirst({
      where: {
        deletedAt: null,
        expiresAt: { gt: this.clock() },
        photos: { some: { photoId: id } },
        space: {
          ...liveSpaceWhere(this.clock()),
          memberships: { some: { userId: viewer } },
        },
      },
      select: { spaceId: true },
    });
    if (!reference?.spaceId) throw unavailable();
    await spaceAccess(tx, viewer, reference.spaceId, false, this.clock());
    return photo;
  }
  protected async photoQuota(
    tx: Tx,
    ownerId: string,
    now: Date,
    excludeId?: string,
  ) {
    const count = await tx.photo.count({
      where: {
        ownerId,
        dayKey: dayKey(now.toISOString()),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { uploadedAt: { not: null } },
          { state: "PENDING", uploadExpiresAt: { gt: now } },
        ],
      },
    });
    if (count >= DAILY_IMAGES)
      throw new SocialError(409, "Daily photograph allowance reached");
  }
  protected async quota(
    tx: Tx,
    ownerId: string,
    hasLink: boolean,
    now: Date,
    replacingId?: string,
  ) {
    const posts = await tx.post.findMany({
      where: {
        ownerId,
        spaceId: null,
        dayKey: dayKey(now.toISOString()),
        deletedAt: null,
        ...(replacingId ? { id: { not: replacingId } } : {}),
      },
      select: { hasLink: true },
    });
    if (
      (hasLink && posts.length) ||
      posts.some((p) => p.hasLink) ||
      posts.length >= DAILY_REGULAR_POSTS
    )
      throw new SocialError(409, "Daily post allowance reached");
  }
  protected postData(ownerId: string, body: string, now: Date) {
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
      select: {
        id: true,
        account: { select: { status: true, displayName: true } },
      },
    });
    return user
      ? {
          id: user.id,
          name: user.account?.displayName ?? "Margin member",
          accountStatus: user.account?.status ?? "PENDING",
        }
      : null;
  }
  /** Only names and relationship state are visible before friendship; content is server filtered. */
  async profile(
    subject: string,
    targetId: string,
    before?: string,
    atPost?: string,
  ): Promise<PrivateProfileData> {
    return this.transaction(async (tx) => {
      const viewerId = await this.actor(tx, subject);
      await this.lock(tx, [viewerId, targetId]);
      const owner = await tx.user.findFirst({
        where: { id: targetId, ...active },
        select: {
          id: true,
          account: {
            select: {
              displayName: true,
              username: true,
              bio: true,
              portraitPhotoId: true,
              galleryVersion: true,
              messagingEnabled: true,
            },
          },
        },
      });
      if (!owner || (await this.blocked(tx, viewerId, targetId)))
        throw unavailable();
      const friendship =
        viewerId === targetId
          ? null
          : await tx.friendship.findUnique({
              where: { lowId_highId: pair(viewerId, targetId) },
            });
      const relationship =
        viewerId === targetId
          ? "self"
          : friendship?.status === "ACCEPTED"
            ? "friends"
            : friendship
              ? friendship.requesterId === viewerId
                ? "outgoing"
                : "incoming"
              : "none";
      const canRead = relationship === "self" || relationship === "friends";
      // A cursor never widens the owner/audience scope, including forged foreign post IDs.
      const anchor =
        canRead && (before || atPost)
          ? await tx.post.findFirst({
              where: {
                id: before ?? atPost,
                spaceId: null,
                ownerId: targetId,
                deletedAt: null,
                expiresAt: { gt: this.clock() },
              },
              select: { id: true, createdAt: true },
            })
          : null;
      if ((before || atPost) && !anchor) throw unavailable();
      const rows = canRead
        ? await tx.post.findMany({
            where: {
              ownerId: targetId,
              spaceId: null,
              deletedAt: null,
              expiresAt: { gt: this.clock() },
              ...(anchor
                ? {
                    OR: [
                      { createdAt: { lt: anchor.createdAt } },
                      {
                        createdAt: anchor.createdAt,
                        id: atPost ? { lte: anchor.id } : { lt: anchor.id },
                      },
                    ],
                  }
                : {}),
            },
            select: postSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 21,
          })
        : [];
      const gallery = canRead
        ? await tx.galleryEntry.findMany({
            where: { ownerId: targetId, photo: { state: "READY" } },
            select: {
              featured: true,
              position: true,
              photo: {
                select: {
                  id: true,
                  description: true,
                  width: true,
                  height: true,
                },
              },
            },
            orderBy: [{ position: "asc" }, { photoId: "asc" }],
            take: 20,
          })
        : [];
      const pending =
        relationship === "self"
          ? await tx.friendship.findMany({
              where: {
                OR: [{ lowId: viewerId }, { highId: viewerId }],
                status: "PENDING",
                requesterId: { not: viewerId },
                low: {
                  ...active,
                  blocksSent: { none: { blockedId: viewerId } },
                  blocksReceived: { none: { blockerId: viewerId } },
                },
                high: {
                  ...active,
                  blocksSent: { none: { blockedId: viewerId } },
                  blocksReceived: { none: { blockerId: viewerId } },
                },
              },
              select: {
                low: {
                  select: {
                    id: true,
                    account: { select: { displayName: true } },
                  },
                },
                high: {
                  select: {
                    id: true,
                    account: { select: { displayName: true } },
                  },
                },
              },
              orderBy: [{ lowId: "asc" }, { highId: "asc" }],
              take: 20,
            })
          : [];
      const viewer =
        viewerId === owner.id
          ? owner
          : await tx.user.findUniqueOrThrow({
              where: { id: viewerId },
              select: {
                id: true,
                account: {
                  select: { displayName: true, portraitPhotoId: true },
                },
              },
            });
      const songs = canRead
        ? await tx.profileSong.findMany({
            where: { userId: targetId },
            orderBy: { position: "asc" },
            take: 1,
          })
        : [];
      return {
        viewerId,
        viewer: memberPerson(viewer.id, viewer.account!),
        profile: {
          id: owner.id,
          name: owner.account!.displayName,
          messagingEnabled: owner.account!.messagingEnabled,
          username: owner.account!.username ?? "",
          bio: owner.account!.bio,
          portraitPhotoId: owner.account!.portraitPhotoId,
          galleryVersion:
            relationship === "self" ? owner.account!.galleryVersion : 0,
          onRepeat: songs.map(profileTrackFromRow),
          relationship,
        },
        posts: rows.slice(0, 20).map((post) => ({
          id: post.id,
          body: post.body,
          createdAt: post.createdAt.toISOString(),
          expiresAt: post.expiresAt.toISOString(),
          photos: post.photos.map(({ photo }) => photo),
        })),
        gallery: gallery.map(({ photo, featured, position }) => ({
          ...photo,
          featured,
          position,
        })),
        requests: pending.map(({ low, high }) => {
          const person = low.id === viewerId ? high : low;
          return { id: person.id, name: person.account!.displayName };
        }),
        nextCursor: rows.length > 20 ? rows[19].id : null,
      };
    });
  }
  async createReport(subject: string, input: ReportInput) {
    if (!["profile", "post", "message"].includes(input.target.kind))
      throw new SocialError(
        400,
        "This report type is not connected to the live service yet.",
      );
    return this.transaction(async (tx) => {
      const reporter = await this.actor(tx, subject);
      let targetPersonId = input.target.personId;
      if (input.target.kind === "message") {
        const message = await tx.memberMessage.findFirst({
          where: {
            id: input.target.id,
            OR: [
              { senderId: reporter, hiddenBySender: false },
              { recipientId: reporter, hiddenByRecipient: false },
            ],
          },
          select: { senderId: true, recipientId: true },
        });
        if (!message) throw unavailable();
        targetPersonId =
          message.senderId === reporter
            ? message.recipientId
            : message.senderId;
        if (
          targetPersonId === reporter ||
          targetPersonId !== input.target.personId
        )
          throw unavailable();
      } else if (input.target.kind === "post") {
        const post = await tx.post.findUnique({
          where: { id: input.target.id },
          select: {
            ownerId: true,
            spaceId: true,
            deletedAt: true,
            expiresAt: true,
          },
        });
        if (!post || post.deletedAt || post.expiresAt <= this.clock())
          throw unavailable();
        await this.postAudience(tx, reporter, post);
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
      if (action === "remove" || action === "block")
        await tx.memberNotification.deleteMany({
          where: {
            kind: { in: ["friend_request", "friend_accepted"] },
            OR: [
              { recipientId: actorId, actorId: targetId },
              { recipientId: targetId, actorId },
            ],
          },
        });
      if (action === "block") {
        await tx.spaceInvitation.deleteMany({
          where: {
            OR: [
              { inviterId: actorId, inviteeId: targetId },
              { inviterId: targetId, inviteeId: actorId },
            ],
          },
        });
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
          await this.notify(
            tx,
            targetId,
            actorId,
            "friend_accepted",
            `friend-accepted:${key.lowId}:${key.highId}`,
          );
        } else if (!existing) {
          await tx.friendship.create({
            data: { ...key, requesterId: actorId },
          });
          await this.notify(
            tx,
            targetId,
            actorId,
            "friend_request",
            `friend-request:${key.lowId}:${key.highId}`,
          );
        }
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
    spaceId?: string,
  ) {
    return (await this.uploadPhoto(subject, bytes, type, description, spaceId))
      .post!;
  }
  protected async uploadPhoto(
    subject: string,
    bytes: Uint8Array,
    type: string,
    description: string,
    spaceId?: string,
    galleryOnly = false,
    replacementPhotoId?: string,
  ) {
    // Authenticate and reserve BEFORE decoding/storage. Pending reservations expire after 10 min.
    const reservation = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const now = this.clock();
      if (spaceId) {
        await spaceAccess(tx, ownerId, spaceId, true, this.clock());
        await releaseSpacePhotoReferences(tx, spaceId, now);
        const slots = await tx.spacePhoto.count({
          where: {
            spaceId,
            photo: {
              OR: [
                { state: "READY" },
                { state: "PENDING", uploadExpiresAt: { gt: now } },
              ],
            },
          },
        });
        if (slots >= SPACE_PHOTO_LIMIT)
          throw new SocialError(
            409,
            `This Space already retains ${SPACE_PHOTO_LIMIT} photographs`,
          );
      } else {
        if (!galleryOnly) await this.quota(tx, ownerId, false, now);
        const slots =
          (await tx.galleryEntry.count({ where: { ownerId } })) +
          (await tx.photo.count({
            where: {
              ownerId,
              state: "PENDING",
              uploadExpiresAt: { gt: now },
              spaceReferences: { none: {} },
            },
          }));
        if (
          replacementPhotoId &&
          !(await tx.galleryEntry.findFirst({
            where: { photoId: replacementPhotoId, ownerId },
            select: { photoId: true },
          }))
        )
          throw unavailable();
        if (slots >= 20 && (!replacementPhotoId || slots > 20))
          throw new SocialError(
            409,
            "Gallery is full; choose a photograph to replace.",
          );
      }
      await this.photoQuota(tx, ownerId, now);
      return tx.photo.create({
        data: {
          ownerId,
          ...(spaceId ? { spaceReferences: { create: { spaceId } } } : {}),
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
        const membership = spaceId
          ? await spaceAccess(tx, actorId, spaceId, true, this.clock())
          : null;
        if (!spaceId && !galleryOnly) await this.quota(tx, actorId, false, now);
        await this.photoQuota(tx, actorId, now, pending.id);
        const savedPhoto = await tx.photo.update({
          where: { id: pending.id },
          data: {
            state: "READY",
            uploadedAt: now,
            width: photo.width,
            height: photo.height,
            byteLength: photo.byteLength,
          },
          select: { id: true, description: true, width: true, height: true },
        });
        if (!spaceId) {
          if (replacementPhotoId) {
            const removed = await tx.galleryEntry.deleteMany({
              where: { ownerId: actorId, photoId: replacementPhotoId },
            });
            if (removed.count !== 1)
              throw new SocialError(
                409,
                "Your gallery changed. Choose a replacement again.",
              );
            await retireUnreferencedPhotos(tx, [replacementPhotoId], now);
          }
          const last = await tx.galleryEntry.aggregate({
            where: { ownerId: actorId },
            _max: { position: true },
          });
          await tx.galleryEntry.create({
            data: {
              ownerId: actorId,
              photoId: pending.id,
              position: (last._max.position ?? -1) + 1,
            },
          });
          await tx.account.update({
            where: { userId: actorId },
            data: { galleryVersion: { increment: 1 } },
          });
        }
        const post = galleryOnly
          ? null
          : await tx.post.create({
              data: {
                ...this.postData(actorId, "", now),
                ...(spaceId ? { spaceId } : {}),
                ...(membership?.space.expiresAt
                  ? {
                      expiresAt: new Date(
                        Math.min(
                          membership.space.expiresAt.getTime(),
                          now.getTime() + 30 * 86400_000,
                        ),
                      ),
                    }
                  : {}),
                photos: { create: { photoId: pending.id } },
              },
              select: postSelect,
            });
        if (post)
          await notifySpacePost(
            tx,
            actorId,
            membership?.space ?? null,
            post.id,
            now,
          );
        return { post, photo: savedPhoto };
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
      await this.postAudience(tx, actorId, post);
      return post;
    });
  }
  async readPhoto(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actorId = await this.actor(tx, subject);
      const photo = await this.photoAudience(tx, actorId, id);
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
        select: {
          id: true,
          ownerId: true,
          spaceId: true,
          photos: { select: { photoId: true } },
        },
      });
      if (!post) throw unavailable();
      if (post.spaceId) await this.postAudience(tx, ownerId, post, true);
      await tx.postComment.deleteMany({ where: { postId: id } });
      await tx.post.update({
        where: { id },
        data: { deletedAt: this.clock(), body: "" },
      });
      await tx.postPhoto.deleteMany({ where: { postId: id } });
      if (post.spaceId)
        await releaseSpacePhotoReferences(tx, post.spaceId, this.clock());
      await retireUnreferencedPhotos(
        tx,
        post.photos.map((p) => p.photoId),
        this.clock(),
      );
      // Gallery references deliberately survive deleting a post.
    });
  }
  async deletePhoto(subject: string, id: string) {
    const objectKey = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      return this.retirePhoto(tx, ownerId, id);
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
  protected async retirePhoto(tx: Tx, ownerId: string, id: string) {
    const photo = await tx.photo.findFirst({
      where: { id, ownerId },
      select: { id: true, objectKey: true, state: true },
    });
    if (!photo) throw unavailable();
    if (photo.state === "PURGED") return null;
    // Serialize against archiving before a global asset deletion changes its posts.
    const spaces = await tx.spacePhoto.findMany({
      where: { photoId: id },
      select: { spaceId: true },
    });
    for (const { spaceId } of spaces.sort((a, b) =>
      a.spaceId.localeCompare(b.spaceId),
    ))
      await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${spaceId} FOR UPDATE`;
    const archivedReference = await tx.postPhoto.findFirst({
      where: {
        photoId: id,
        post: {
          deletedAt: null,
          expiresAt: { gt: this.clock() },
          space: { deletedAt: null, archivedAt: { not: null } },
        },
      },
      select: { postId: true },
    });
    if (archivedReference)
      throw new SocialError(
        409,
        "This photograph is referenced by a read-only archived event",
      );
    await tx.photo.update({
      where: { id },
      data: { state: "DELETE_PENDING" },
    });
    await tx.account.updateMany({
      where: { userId: ownerId, portraitPhotoId: id },
      data: { portraitPhotoId: null },
    });
    await tx.account.update({
      where: { userId: ownerId },
      data: { galleryVersion: { increment: 1 } },
    });
    await tx.galleryEntry.deleteMany({ where: { photoId: id } });
    await tx.postPhoto.deleteMany({ where: { photoId: id } });
    await tx.spacePhoto.deleteMany({ where: { photoId: id } });
    return photo.objectKey;
  }
  async deactivate(subject: string) {
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      await tx.account.update({
        where: { userId: id },
        data: { status: "DEACTIVATED", portraitPhotoId: null },
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
      await tx.memberMessage.deleteMany({
        where: { OR: [{ senderId: id }, { recipientId: id }] },
      });
      await tx.memberNotification.deleteMany({
        where: { OR: [{ recipientId: id }, { actorId: id }] },
      });
      await tx.postLike.deleteMany({ where: { userId: id } });
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
      select: { id: true, ownerId: true, objectKey: true },
    });
    let purged = 0;
    for (const row of rows) {
      const claimed = await this.transaction(async (tx) => {
        await this.lock(tx, [row.ownerId]);
        const current = await tx.photo.findFirst({
          where: {
            id: row.id,
            ...eligible,
            gallery: { is: null },
            posts: {
              none: {
                post: {
                  deletedAt: null,
                  expiresAt: { gt: this.clock() },
                  OR: [{ spaceId: null }, { space: { deletedAt: null } }],
                },
              },
            },
          },
          select: { id: true },
        });
        if (!current) return false;
        await tx.photo.update({
          where: { id: row.id },
          data: { state: "DELETE_PENDING" },
        });
        await tx.spacePhoto.deleteMany({ where: { photoId: row.id } });
        return true;
      });
      if (!claimed) continue;
      await this.store.delete(row.objectKey);
      const result = await this.db.photo.updateMany({
        where: { id: row.id, state: "DELETE_PENDING" },
        data: { state: "PURGED", description: "" },
      });
      purged += result.count;
    }
    return purged;
  }
  /** Access expires synchronously; this bounded job erases expired text/references later. */
  async expirePosts(limit = 20) {
    const expired = await this.db.post.findMany({
      where: { deletedAt: null, expiresAt: { lte: this.clock() } },
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true, ownerId: true, spaceId: true },
    });
    for (const post of expired)
      await this.transaction(async (tx) => {
        await this.lock(tx, [post.ownerId]);
        if (post.spaceId)
          await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${post.spaceId} FOR UPDATE`;
        const attachments = await tx.postPhoto.findMany({
          where: { postId: post.id },
          select: { photoId: true },
        });
        await tx.postComment.deleteMany({ where: { postId: post.id } });
        await tx.post.updateMany({
          where: {
            id: post.id,
            deletedAt: null,
            expiresAt: { lte: this.clock() },
          },
          data: { deletedAt: this.clock(), body: "" },
        });
        await tx.postPhoto.deleteMany({ where: { postId: post.id } });
        if (post.spaceId)
          await releaseSpacePhotoReferences(tx, post.spaceId, this.clock());
        await retireUnreferencedPhotos(
          tx,
          attachments.map((p) => p.photoId),
          this.clock(),
        );
      });
    return expired.length;
  }
}
