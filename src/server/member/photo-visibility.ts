import type { Prisma } from "@/generated/prisma/client";
import { liveSpaceWhere } from "@/server/spaces/access";
/** Owned assets still require a current surviving reference. An expired or left
 * Space alone never becomes a way to revive a private photograph. */
export function ownedReadablePhotos(
  ownerId: string,
  now: Date,
): Prisma.PhotoWhereInput {
  return {
    ownerId,
    state: "READY",
    OR: [
      { gallery: { isNot: null } },
      { portraits: { some: { userId: ownerId } } },
      {
        posts: {
          some: {
            post: {
              deletedAt: null,
              expiresAt: { gt: now },
              OR: [
                { spaceId: null },
                {
                  space: {
                    ...liveSpaceWhere(now),
                    memberships: { some: { userId: ownerId } },
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}
