import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSpaceWhere, unblockedAuthor, acceptedFriendOf } from "./access";

const PREFIX = "space-invitation:";
export const spaceInvitationNotificationKey = (id: string) => `${PREFIX}${id}`;
export function spaceInvitationId(key: string) {
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
}

/** Invitations grant only a targeted invitation summary, never Space contents. */
export async function visibleSpaceInvitation(
  tx: Prisma.TransactionClient,
  recipientId: string,
  invitationId: string,
  now: Date,
  inviterId?: string,
) {
  const invitation = await tx.spaceInvitation.findFirst({
    where: {
      id: invitationId,
      inviteeId: recipientId,
      ...(inviterId ? { inviterId } : {}),
      acceptedAt: null,
      expiresAt: { gt: now },
      inviter: {
        ...unblockedAuthor(recipientId),
        ...acceptedFriendOf(recipientId),
      },
      space: {
        ...liveSpaceWhere(now),
        archivedAt: null,
        memberships: { none: { userId: recipientId } },
      },
    },
    select: {
      id: true,
      inviterId: true,
      space: { select: { id: true, name: true, kind: true } },
    },
  });
  if (!invitation) return null;
  const inviter = await tx.spaceMembership.findUnique({
    where: {
      spaceId_userId: {
        spaceId: invitation.space.id,
        userId: invitation.inviterId,
      },
    },
    select: { role: true },
  });
  return inviter?.role === "ADMIN" ? invitation : null;
}

/** Bounded reconciliation for invitations issued before notification delivery
 * was connected. New invitations create their notification in the same write
 * transaction; the unique dedupe key preserves existing read state. */
export async function missingSpaceInvitationNotifications(
  tx: Prisma.TransactionClient,
  recipientId: string,
  now: Date,
) {
  return tx.$queryRaw<{ id: string; inviterId: string }[]>`
    SELECT invitation.id, invitation."inviterId"
    FROM "SpaceInvitation" invitation
    WHERE invitation."inviteeId" = ${recipientId}
      AND invitation."acceptedAt" IS NULL
      AND invitation."expiresAt" > ${now}
      AND NOT EXISTS (
        SELECT 1 FROM "MemberNotification" notification
        WHERE notification."dedupeKey" = ${PREFIX} || invitation.id
      )
    ORDER BY invitation.id DESC LIMIT 50
  `;
}
