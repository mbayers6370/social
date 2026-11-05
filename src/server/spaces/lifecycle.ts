import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { retireUnreferencedPhotos } from "./media-lifecycle";
import { SocialService } from "@/server/social/service";
import { SocialError } from "@/server/social/errors";
import { spaceAccess } from "./access";

export async function eraseSpace(
  tx: Prisma.TransactionClient,
  id: string,
  clock: () => Date,
) {
  const photoIds = (
    await tx.spacePhoto.findMany({
      where: { spaceId: id },
      select: { photoId: true },
    })
  ).map((r) => r.photoId);
  await tx.post.deleteMany({ where: { spaceId: id } });
  await tx.spacePhoto.deleteMany({ where: { spaceId: id } });
  await tx.spaceInvitation.deleteMany({ where: { spaceId: id } });
  await tx.spaceMembership.deleteMany({ where: { spaceId: id } });
  await tx.space.update({
    where: { id },
    data: {
      deletedAt: clock(),
      name: "Deleted Space",
      startsAt: null,
      timeZone: null,
      location: null,
      endsAt: null,
      expiresAt: null,
      imageUrl: null,
      sourceUrl: null,
    },
  });
  await retireUnreferencedPhotos(tx, photoIds, clock());
}

export class SpaceLifecycleService extends SocialService {
  async deleteSpace(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const membership = await spaceAccess(tx, actor, id, false, this.clock());
      if (membership.space.kind === "EVENT")
        throw new SocialError(
          403,
          "Public Event Spaces close through scheduled expiry.",
        );
      if (membership.space.creatorId !== actor)
        throw new SocialError(403, "Only the creator can delete this Space");
      await eraseSpace(tx, id, this.clock);
    });
  }

  /** Trusted maintenance entry point; access is denied at the deadline even before this runs. */
  async expireSpaces(limit = 20, signal?: AbortSignal) {
    const rows = await this.db.space.findMany({
      where: {
        kind: "EVENT",
        deletedAt: null,
        expiresAt: { lte: this.clock() },
      },
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true },
    });
    let expired = 0;
    for (const row of rows) {
      if (signal?.aborted) break;
      const removed = await this.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${row.id} FOR UPDATE`;
        const current = await tx.space.findFirst({
          where: {
            id: row.id,
            deletedAt: null,
            expiresAt: { lte: this.clock() },
          },
          select: { id: true },
        });
        if (!current) return false;
        await eraseSpace(tx, row.id, this.clock);
        return true;
      });
      if (removed) expired++;
    }
    return expired;
  }
}
