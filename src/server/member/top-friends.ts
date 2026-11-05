import "server-only";
import { createHash } from "node:crypto";
import { SocialError } from "@/server/social/errors";
import type { z } from "zod";
import type { memberTopFriendsInput } from "@/features/social/member-schema";
import type { Prisma } from "@/generated/prisma/client";
import { memberPerson } from "@/lib/member-person";
import { acceptedFriendOf, unblockedAuthor } from "@/server/spaces/access";

export const eligibleTopFriend = (ownerId: string): Prisma.UserWhereInput => ({
  AND: [acceptedFriendOf(ownerId), unblockedAuthor(ownerId)],
  id: { not: ownerId },
});

/** Call only after authorizing the viewer to the owner's private profile.
 * Eligibility is rechecked on every read, including changes made outside the app. */
export async function readTopFriends(
  tx: Prisma.TransactionClient,
  ownerId: string,
  viewerId = ownerId,
) {
  const rows = await tx.profileTopFriend.findMany({
    where: {
      ownerId,
      friend: { AND: [eligibleTopFriend(ownerId), unblockedAuthor(viewerId)] },
    },
    orderBy: { position: "asc" },
    take: 4,
    select: {
      friend: {
        select: {
          id: true,
          account: { select: { displayName: true, portraitPhotoId: true } },
        },
      },
    },
  });
  return rows.map(({ friend }) => memberPerson(friend.id, friend.account!));
}

/** Full replacement avoids transient position collisions during a reorder. */
export async function replaceTopFriends(
  tx: Prisma.TransactionClient,
  ownerId: string,
  friendIds: string[],
) {
  // A row lock alone does not advance a Serializable snapshot. Touch the owner
  // so a waiter with an older snapshot gets a retryable write conflict, rather
  // than attempting inserts against an invisible newer selection.
  await tx.user.update({
    where: { id: ownerId },
    data: { updatedAt: new Date() },
  });
  await tx.profileTopFriend.deleteMany({ where: { ownerId } });
  if (friendIds.length)
    await tx.profileTopFriend.createMany({
      data: friendIds.map((friendId, position) => ({
        ownerId,
        friendId,
        position,
      })),
    });
}

/** Runs inside the existing lifecycle transaction. Serializable conflict retries
 * coordinate inbound cleanup with an owner's concurrent full-list replacement. */
export async function pruneTopFriends(
  tx: Prisma.TransactionClient,
  memberId: string,
  otherId?: string,
) {
  const rows = await tx.profileTopFriend.findMany({
    where: otherId
      ? {
          OR: [
            { ownerId: memberId, friendId: otherId },
            { ownerId: otherId, friendId: memberId },
          ],
        }
      : { OR: [{ ownerId: memberId }, { friendId: memberId }] },
    select: { ownerId: true },
  });
  for (const ownerId of [...new Set(rows.map((row) => row.ownerId))].sort()) {
    const eligible =
      ownerId === memberId && !otherId ? [] : await readTopFriends(tx, ownerId);
    await replaceTopFriends(
      tx,
      ownerId,
      eligible.map((person) => person.id),
    );
  }
}

/** Called by MemberService with its verified actor in a Serializable transaction. */
export async function topFriendCandidates(
  tx: Prisma.TransactionClient,
  ownerId: string,
  query: string,
  before?: string,
) {
  const rows = await tx.user.findMany({
    where: {
      AND: [
        eligibleTopFriend(ownerId),
        ...(query
          ? [
              {
                OR: [
                  {
                    account: {
                      is: {
                        displayName: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                  {
                    account: {
                      is: {
                        username: {
                          contains: query.replace(/^@/, ""),
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
      ...(before ? { id: { gt: before } } : {}),
    },
    select: {
      id: true,
      account: {
        select: {
          displayName: true,
          username: true,
          portraitPhotoId: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: 31,
  });
  return {
    selected: await readTopFriends(tx, ownerId),
    contacts: rows.slice(0, 30).map((row) => ({
      person: memberPerson(row.id, row.account!),
      username: row.account!.username ?? "",
      relationship: "friends" as const,
    })),
    nextCursor: rows.length > 30 ? rows[29].id : null,
  };
}

/** The caller holds the existing sorted user locks for owner and selected friends. */
export async function saveTopFriends(
  tx: Prisma.TransactionClient,
  ownerId: string,
  input: z.infer<typeof memberTopFriendsInput>,
) {
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input.friendIds))
    .digest("hex");
  const receipt = await tx.profileTopFriendMutation.findUnique({
    where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
  });
  if (receipt) {
    if (receipt.payloadHash !== payloadHash)
      throw new SocialError(
        409,
        "This save request was already used. Reopen Top 4 and try again.",
      );
    return { selected: await readTopFriends(tx, ownerId) };
  }
  const eligible = await tx.user.count({
    where: {
      AND: [eligibleTopFriend(ownerId)],
      id: { in: input.friendIds },
    },
  });
  if (eligible !== input.friendIds.length)
    throw new SocialError(
      400,
      "Choose only active, accepted friends who are not blocked.",
    );
  await replaceTopFriends(tx, ownerId, input.friendIds);
  await tx.profileTopFriendMutation.create({
    data: { ownerId, requestId: input.requestId, payloadHash },
  });
  return { selected: await readTopFriends(tx, ownerId) };
}
