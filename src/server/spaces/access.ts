import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { SocialError, unavailable } from "@/server/social/errors";
export const liveSpaceWhere = (now: Date): Prisma.SpaceWhereInput => ({
  deletedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});
export async function spaceAccess(
  tx: Prisma.TransactionClient,
  viewerId: string,
  spaceId: string,
  write = false,
  now = new Date(),
) {
  // Every Space mutation serializes with removal, archiving and slot reservations.
  await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${spaceId} FOR UPDATE`;
  const membership = await tx.spaceMembership.findUnique({
    where: { spaceId_userId: { spaceId, userId: viewerId } },
    include: { space: true },
  });
  if (
    !membership ||
    membership.space.deletedAt ||
    (membership.space.expiresAt && membership.space.expiresAt <= now)
  )
    throw unavailable();
  if (write && membership.space.archivedAt)
    throw new SocialError(409, "This event is archived and read-only");
  return membership;
}
export function requireSpaceAdmin(member: { role: string }) {
  if (member.role !== "ADMIN")
    throw new SocialError(403, "Space administrator access required");
}
export const unblockedAuthor = (viewerId: string): Prisma.UserWhereInput => ({
  account: { is: { status: "ACTIVE" } },
  blocksSent: { none: { blockedId: viewerId } },
  blocksReceived: { none: { blockerId: viewerId } },
});
