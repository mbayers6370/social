import "server-only";
import { ownedReadablePhotos } from "./photo-visibility";
import { SocialError } from "@/server/social/errors";
import { retireUnreferencedPhotos } from "@/server/spaces/media-lifecycle";
import { memberGalleryInput } from "@/features/social/member-schema";
import { SocialService } from "@/server/social/service";
import { unavailable } from "./selectors";

export class MemberGalleryService extends SocialService {
  async personalPhotos(subject: string, before?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.photo.findMany({
        where: {
          ...ownedReadablePhotos(actor, this.clock()),
          ...(before ? { id: { lt: before } } : {}),
        },
        select: { id: true, description: true, width: true, height: true },
        orderBy: { id: "desc" },
        take: 21,
      });
      return {
        photos: rows.slice(0, 20),
        nextCursor: rows.length > 20 ? rows[19].id : null,
      };
    });
  }

  async uploadGallery(
    subject: string,
    bytes: Uint8Array,
    type: string,
    description = "Photograph",
    replacementPhotoId?: string,
  ) {
    return (
      await this.uploadPhoto(
        subject,
        bytes,
        type,
        description,
        undefined,
        true,
        replacementPhotoId,
      )
    ).photo;
  }

  async arrangeGallery(subject: string, raw: unknown) {
    const input = memberGalleryInput.parse(raw);
    const retired = await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      const account = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: { galleryVersion: true },
      });
      if (account.galleryVersion !== input.version)
        throw new SocialError(
          409,
          "Your gallery changed. Close and reopen the editor before saving.",
        );
      const ids = input.entries.map((entry) => entry.photoId);
      for (const photoId of ids) {
        const photo = await this.photoAudience(tx, id, photoId);
        if (photo.ownerId !== id) throw unavailable();
      }
      const previous = await tx.galleryEntry.findMany({
        where: { ownerId: id },
        select: { photoId: true },
      });
      if (
        input.deletedPhotoIds.some(
          (photoId) =>
            ids.includes(photoId) ||
            !previous.some((entry) => entry.photoId === photoId),
        ) ||
        new Set(input.deletedPhotoIds).size !== input.deletedPhotoIds.length
      )
        throw new SocialError(400, "Choose a gallery photograph to delete.");
      const retired: { id: string; key: string }[] = [];
      for (const photoId of input.deletedPhotoIds) {
        const key = await this.retirePhoto(tx, id, photoId);
        if (key) retired.push({ id: photoId, key });
      }
      await tx.galleryEntry.deleteMany({ where: { ownerId: id } });
      for (const [position, entry] of input.entries.entries())
        await tx.galleryEntry.create({
          data: { ...entry, ownerId: id, position },
        });
      await tx.account.update({
        where: { userId: id },
        data: { galleryVersion: { increment: 1 } },
      });
      await retireUnreferencedPhotos(
        tx,
        previous
          .map((entry) => entry.photoId)
          .filter((photoId) => !ids.includes(photoId)),
        this.clock(),
      );
      return retired;
    });
    for (const photo of retired) {
      await this.store.delete(photo.key);
      await this.db.photo.updateMany({
        where: { id: photo.id, state: "DELETE_PENDING" },
        data: { state: "PURGED", description: "" },
      });
    }
    return { saved: true };
  }
}
