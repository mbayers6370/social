import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

const receipt = z.strictObject({
  userId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  clerkId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .nullable(),
  requestedAt: z.iso.datetime(),
  providerDeletedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});
const archive = z.strictObject({
  version: z.literal(1),
  receipts: z.array(receipt).max(100_000),
});
export type ErasureReceipt = z.infer<typeof receipt>;
export const parseErasureReceipt = (raw: unknown) => receipt.parse(raw);

/** Private operator backup journal. Export independently of DB snapshots and
 * import the latest journal BEFORE restoring public traffic to an older DB. */
export async function exportErasureReceipts(db: PrismaClient) {
  return {
    version: 1,
    receipts: await db.accountErasure.findMany({
      select: {
        userId: true,
        clerkId: true,
        requestedAt: true,
        providerDeletedAt: true,
        completedAt: true,
      },
      orderBy: { requestedAt: "asc" },
    }),
  };
}

export async function importErasureReceipts(
  db: PrismaClient,
  raw: unknown,
  now = new Date(),
) {
  const { receipts } = archive.parse(raw);
  let restored = 0;
  for (const record of receipts) {
    const requestedAt = new Date(record.requestedAt);
    const completedAt = record.completedAt
      ? new Date(record.completedAt)
      : null;
    if (completedAt && completedAt.getTime() < now.getTime() - 90 * 86_400_000)
      continue;
    await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: record.userId },
        select: { clerkId: true },
      });
      const existing = await tx.accountErasure.findUnique({
        where: { userId: record.userId },
      });
      const data = user
        ? {
            clerkId: user.clerkId,
            providerDeletedAt: null,
            completedAt: null,
          }
        : {
            clerkId: existing?.completedAt
              ? null
              : (existing?.clerkId ?? record.clerkId),
            providerDeletedAt:
              existing?.providerDeletedAt ??
              (record.providerDeletedAt
                ? new Date(record.providerDeletedAt)
                : null),
            completedAt: existing?.completedAt ?? completedAt,
          };
      if (!user && !data.completedAt && !data.clerkId)
        throw Error("Incomplete erasure receipt");
      await tx.accountErasure.upsert({
        where: { userId: record.userId },
        create: {
          userId: record.userId,
          requestedAt,
          nextAttemptAt: now,
          ...data,
        },
        update: { nextAttemptAt: now, ...data },
      });
      if (user)
        await tx.account.updateMany({
          where: { userId: record.userId },
          data: { status: "DEACTIVATED", portraitPhotoId: null },
        });
    });
    restored++;
  }
  return restored;
}
