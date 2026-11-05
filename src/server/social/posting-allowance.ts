import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { DAILY_REGULAR_POSTS } from "@/lib/platform-rules";
import { postingDayWindow } from "@/lib/posting-day";

export async function memberPostingWindow(
  tx: Prisma.TransactionClient,
  ownerId: string,
  now: Date,
  replacingId?: string,
) {
  const account = await tx.account.findUniqueOrThrow({
    where: { userId: ownerId },
    select: {
      postingTimeZone: true,
      postingUsageCarryFrom: true,
      postingUsageCarryUntil: true,
    },
  });
  const original = replacingId
    ? await tx.postingUsage.findUnique({
        where: { postId: replacingId },
        select: { timeZone: true },
      })
    : null;
  return postingDayWindow(
    now,
    original?.timeZone ?? account.postingTimeZone,
    replacingId
      ? undefined
      : {
          from: account.postingUsageCarryFrom,
          until: account.postingUsageCarryUntil,
        },
  );
}
export async function dailyPostAllowance(
  tx: Prisma.TransactionClient,
  ownerId: string,
  now: Date,
  replacingId?: string,
) {
  const window = await memberPostingWindow(tx, ownerId, now, replacingId);
  const createdAt = { gte: window.start, lt: window.end };
  const usage = await tx.postingUsage.findMany({
    where: {
      ownerId,
      createdAt,
      ...(replacingId ? { postId: { not: replacingId } } : {}),
    },
    select: { postId: true, hasLink: true },
  });
  const posts = await tx.post.findMany({
    where: {
      ownerId,
      spaceId: null,
      createdAt,
      ...(replacingId ? { id: { not: replacingId } } : {}),
    },
    select: { id: true, hasLink: true },
  });
  const records = new Map(usage.map((row) => [row.postId, row.hasLink]));
  for (const post of posts)
    if (!records.has(post.id)) records.set(post.id, post.hasLink);
  return {
    regularRemaining: [...records.values()].some(Boolean)
      ? 0
      : Math.max(0, DAILY_REGULAR_POSTS - records.size),
    linkAllowed: records.size === 0,
    timeZone: window.timeZone,
  };
}
export async function recordPublication(
  tx: Prisma.TransactionClient,
  post: {
    id: string;
    ownerId: string;
    spaceId?: string | null;
    createdAt: Date;
    hasLink: boolean;
  },
) {
  if (post.spaceId) return;
  const { postingTimeZone } = await tx.account.findUniqueOrThrow({
    where: { userId: post.ownerId },
    select: { postingTimeZone: true },
  });
  await tx.postingUsage.upsert({
    where: { postId: post.id },
    create: {
      postId: post.id,
      ownerId: post.ownerId,
      createdAt: post.createdAt,
      hasLink: post.hasLink,
      timeZone: postingTimeZone,
    },
    update: { hasLink: post.hasLink },
  });
}
