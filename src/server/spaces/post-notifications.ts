import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { unblockedAuthor } from "./access";

/** Called within the publication transaction, while the Space lock is held. */
export async function notifySpacePost(
  tx: Prisma.TransactionClient,
  actor: string,
  space: { id: string; kind: "PRIVATE" | "GATHERING" | "EVENT" } | null,
  postId: string,
  now: Date,
) {
  if (!space || space.kind === "EVENT") return;
  let after: string | undefined;
  while (true) {
    const recipients = await tx.spaceMembership.findMany({
      where: {
        spaceId: space.id,
        userId: { not: actor, ...(after ? { gt: after } : {}) },
        user: unblockedAuthor(actor),
      },
      select: { userId: true },
      orderBy: { userId: "asc" },
      take: 200,
    });
    if (!recipients.length) break;
    await tx.memberNotification.createMany({
      data: recipients.map(({ userId }) => ({
        recipientId: userId,
        actorId: actor,
        kind: "space_post",
        postId,
        dedupeKey: `space-post:${postId}:${userId}`,
        createdAt: now,
      })),
      skipDuplicates: true,
    });
    if (recipients.length < 200) break;
    after = recipients.at(-1)!.userId;
  }
}
