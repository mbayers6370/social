import "server-only";
import { notifySpacePost } from "./post-notifications";
import { memberPostDraftInput } from "@/features/social/member-schema";
import { containsPostLink } from "@/lib/platform-rules";
import { randomUUID } from "node:crypto";
import {
  memberPostingWindow,
  recordPublication,
} from "@/server/social/posting-allowance";
import { normalizePhoto } from "@/server/social/photo";
import { Prisma } from "@/generated/prisma/client";
import { liveSpaceWhere } from "./access";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import { SPACE_PHOTO_LIMIT } from "@/lib/platform-rules";
import { spacePostDraftInput, spacePostInput } from "@/features/spaces/schema";
import { releaseSpacePhotoReferences } from "./media-lifecycle";
import { SocialService } from "@/server/social/service";
import { SocialError, unavailable } from "@/server/social/errors";
import { spaceAccess } from "./access";

export class SpacePublicationService extends SocialService {
  async publish(subject: string, id: string, raw: unknown) {
    const input = spacePostInput.parse(raw);
    if (new Set(input.photoIds).size !== input.photoIds.length)
      throw new SocialError(400, "Choose each photograph once");
    return this.transaction((tx) =>
      this.publishInTransaction(tx, subject, id, input),
    );
  }

  async publishInTransaction(
    tx: Prisma.TransactionClient,
    subject: string,
    id: string | undefined,
    input: { body: string; photoIds: string[] },
  ) {
    const actor = await this.actor(tx, subject);
    await this.lock(tx, [actor]);
    const membership = id
      ? await spaceAccess(tx, actor, id, true, this.clock())
      : null;
    if (id) await releaseSpacePhotoReferences(tx, id, this.clock());
    else
      await this.quota(
        tx,
        actor,
        containsPostLink({ body: input.body }),
        this.clock(),
      );
    for (const photoId of input.photoIds) {
      const photo = await this.photoAudience(tx, actor, photoId);
      if (photo.ownerId !== actor) throw unavailable();
      if (!id) continue;
      const present = await tx.spacePhoto.findUnique({
        where: { spaceId_photoId: { spaceId: id, photoId } },
      });
      if (!present) {
        const count = await tx.spacePhoto.count({
          where: {
            spaceId: id,
            photo: {
              OR: [
                { state: "READY" },
                { state: "PENDING", uploadExpiresAt: { gt: this.clock() } },
              ],
            },
          },
        });
        if (count >= SPACE_PHOTO_LIMIT)
          throw new SocialError(
            409,
            `This Space already retains ${SPACE_PHOTO_LIMIT} photographs`,
          );
        await tx.spacePhoto.create({ data: { spaceId: id, photoId } });
      }
    }
    const post = await tx.post.create({
      data: {
        ...this.postData(actor, input.body, this.clock()),
        ...(id ? { spaceId: id } : {}),
        ...(membership?.space.expiresAt
          ? {
              expiresAt: new Date(
                Math.min(
                  membership.space.expiresAt.getTime(),
                  this.clock().getTime() + 30 * 86400_000,
                ),
              ),
            }
          : {}),
        photos: { create: input.photoIds.map((photoId) => ({ photoId })) },
      },
      select: {
        id: true,
        ownerId: true,
        spaceId: true,
        createdAt: true,
        hasLink: true,
      },
    });
    await recordPublication(tx, post);
    await notifySpacePost(
      tx,
      actor,
      membership?.space ?? null,
      post.id,
      this.clock(),
    );
    return post;
  }

  /** Reserve every upload, then publish text and all attachments atomically. */
  async publishWithUploads(
    subject: string,
    id: string | undefined,
    raw: unknown,
    files: { bytes: Uint8Array; type: string; description?: string }[],
  ) {
    const input = (id ? spacePostDraftInput : memberPostDraftInput).parse(raw);
    if (
      !files.length ||
      files.length + input.photoIds.length > 3 ||
      new Set(input.photoIds).size !== input.photoIds.length
    )
      throw new SocialError(400, "Choose up to three photographs.");
    for (const file of files) {
      if (!file.bytes.length || file.bytes.length > PHOTO_MAX_BYTES)
        throw new SocialError(400, "Invalid photograph.");
    }
    const reservations = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const now = this.clock();
      if (id) {
        await spaceAccess(tx, ownerId, id, true, now);
        await releaseSpacePhotoReferences(tx, id, now);
      } else
        await this.quota(
          tx,
          ownerId,
          containsPostLink({ body: input.body }),
          now,
        );
      // Recheck owned saved attachments before reserving bytes or daily allowance.
      for (const photoId of input.photoIds) {
        const photo = await this.photoAudience(tx, ownerId, photoId);
        if (photo.ownerId !== ownerId) throw unavailable();
      }
      const reservations = [];
      for (const file of files) {
        await this.photoQuota(tx, ownerId, now);
        const slots = id
          ? await tx.spacePhoto.count({
              where: {
                spaceId: id,
                photo: {
                  OR: [
                    { state: "READY" },
                    { state: "PENDING", uploadExpiresAt: { gt: now } },
                  ],
                },
              },
            })
          : (await tx.galleryEntry.count({ where: { ownerId } })) +
            (await tx.photo.count({
              where: {
                ownerId,
                state: "PENDING",
                uploadExpiresAt: { gt: now },
                spaceReferences: { none: {} },
              },
            }));
        if (slots >= SPACE_PHOTO_LIMIT)
          throw new SocialError(
            409,
            id
              ? `This Space already retains ${SPACE_PHOTO_LIMIT} photographs`
              : "Your gallery is full. Reuse a saved photograph or replace a gallery photograph first.",
          );
        reservations.push(
          await tx.photo.create({
            data: {
              ownerId,
              objectKey: `social/${randomUUID()}.webp`,
              dayKey: (await memberPostingWindow(tx, ownerId, now)).key,
              createdAt: now,
              uploadExpiresAt: new Date(now.getTime() + 600_000),
              description: file.description?.trim() || "Photograph",
              width: 1,
              height: 1,
              byteLength: 1,
              ...(id ? { spaceReferences: { create: { spaceId: id } } } : {}),
            },
          }),
        );
      }
      return reservations;
    });
    try {
      const normalized: Awaited<ReturnType<typeof normalizePhoto>>[] = [];
      for (let index = 0; index < files.length; index++) {
        const photo = await normalizePhoto(
          files[index].bytes,
          files[index].type,
        );
        await this.store.put(reservations[index].objectKey, photo.bytes);
        normalized.push(photo);
      }
      return await this.transaction(async (tx) => {
        const ownerId = await this.actor(tx, subject);
        await this.lock(tx, [ownerId]);
        const now = this.clock();
        if (id) await spaceAccess(tx, ownerId, id, true, now);
        else if (
          (await tx.galleryEntry.count({ where: { ownerId } })) +
            reservations.length >
          20
        )
          throw new SocialError(
            409,
            "Your gallery changed. Make room before publishing.",
          );
        const post = await this.publishInTransaction(tx, subject, id, input);
        for (let index = 0; index < reservations.length; index++) {
          const pending = await tx.photo.findUniqueOrThrow({
            where: { id: reservations[index].id },
          });
          if (
            pending.ownerId !== ownerId ||
            pending.state !== "PENDING" ||
            pending.uploadExpiresAt <= now ||
            pending.dayKey !== (await memberPostingWindow(tx, ownerId, now)).key
          )
            throw new SocialError(409, "Upload expired; try again");
          await this.photoQuota(tx, ownerId, now, pending.id);
          const photo = normalized[index];
          await tx.photo.update({
            where: { id: pending.id },
            data: {
              state: "READY",
              uploadedAt: now,
              width: photo.width,
              height: photo.height,
              byteLength: photo.byteLength,
            },
          });
        }
        if (!id) {
          const last = await tx.galleryEntry.aggregate({
            where: { ownerId },
            _max: { position: true },
          });
          await tx.galleryEntry.createMany({
            data: reservations.map((photo, index) => ({
              photoId: photo.id,
              ownerId,
              position: (last._max.position ?? -1) + index + 1,
            })),
          });
          await tx.account.update({
            where: { userId: ownerId },
            data: { galleryVersion: { increment: 1 } },
          });
        }
        await tx.postPhoto.createMany({
          data: reservations.map((photo) => ({
            postId: post.id,
            photoId: photo.id,
            ownerId,
          })),
        });
        return post;
      });
    } catch (error) {
      await this.queueFailedUploads(reservations);
      throw error;
    }
  }

  async reusablePhotos(subject: string, spaceId: string, before?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor]);
      await spaceAccess(tx, actor, spaceId, true, this.clock());
      // Only owned, already authorized canonical assets; no cross-owner attachment workaround.
      const photos = await tx.photo.findMany({
        where: {
          ownerId: actor,
          state: "READY",
          ...(before ? { id: { lt: before } } : {}),
          OR: [
            { gallery: { isNot: null } },
            {
              posts: {
                some: {
                  post: {
                    deletedAt: null,
                    expiresAt: { gt: this.clock() },
                    OR: [
                      { spaceId: null },
                      {
                        space: {
                          ...liveSpaceWhere(this.clock()),
                          memberships: { some: { userId: actor } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
        orderBy: { id: "desc" },
        take: 21,
        select: { id: true, description: true, width: true, height: true },
      });
      return {
        photos: photos.slice(0, 20),
        nextCursor: photos.length > 20 ? photos[19].id : null,
      };
    });
  }
}
