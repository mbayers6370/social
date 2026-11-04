import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSpaceWhere } from "./access";
/** References, not thumbnails or feed preferences, determine canonical asset retention. */
export async function retireUnreferencedPhotos(
  tx: Prisma.TransactionClient,
  ids: string[],
  now: Date,
) {
  if (!ids.length) return;
  await tx.photo.updateMany({
    where: {
      id: { in: ids },
      state: "READY",
      gallery: { is: null },
      portraits: { none: {} },
      posts: {
        none: {
          post: {
            deletedAt: null,
            expiresAt: { gt: now },
            OR: [{ spaceId: null }, { space: liveSpaceWhere(now) }],
          },
        },
      },
    },
    data: { state: "DELETE_PENDING" },
  });
}
export async function releaseSpacePhotoReferences(
  tx: Prisma.TransactionClient,
  spaceId: string,
  now: Date,
) {
  const rows = await tx.spacePhoto.findMany({
    where: {
      spaceId,
      photo: {
        NOT: { state: "PENDING", uploadExpiresAt: { gt: now } },
        posts: {
          none: { post: { spaceId, deletedAt: null, expiresAt: { gt: now } } },
        },
      },
    },
    select: { photoId: true },
    take: 100,
  });
  const ids = rows.map((r) => r.photoId);
  if (!ids.length) return;
  await tx.spacePhoto.deleteMany({ where: { spaceId, photoId: { in: ids } } });
  await retireUnreferencedPhotos(tx, ids, now);
}
