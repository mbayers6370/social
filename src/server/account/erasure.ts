import "server-only";
import { createHash } from "node:crypto";
import { SocialService } from "@/server/social/service";
import { SocialError } from "@/server/social/errors";
import { pruneTopFriends } from "@/server/member/top-friends";
import { eraseSpace } from "@/server/spaces/lifecycle";
import type { InvitationProvider } from "./invitation-provider";
import type { PrismaClient, AccountErasure } from "@/generated/prisma/client";
import type { PrivatePhotoStore } from "@/server/social/photo";
import {
  privateErasureJournal,
  erasureReceiptKey,
  type ErasureJournal,
} from "./erasure-journal";

const journalRecord = (row: AccountErasure) => ({
  userId: row.userId,
  clerkId: row.clerkId,
  requestedAt: row.requestedAt.toISOString(),
  providerDeletedAt: row.providerDeletedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
});

export const ERASURE_RECEIPT_DAYS = 90;
export type ErasureProvider = Pick<InvitationProvider, "find" | "revoke"> & {
  deleteUser(subject: string): Promise<void>;
};

/** The caller supplies a verified session subject or a verified user.deleted event.
 * No provider or object-store side effect runs inside a retried DB transaction. */
export class AccountErasureService extends SocialService {
  constructor(
    db: PrismaClient,
    store: PrivatePhotoStore,
    clock: () => Date = () => new Date(),
    private readonly journal: ErasureJournal = privateErasureJournal,
  ) {
    super(db, store, clock);
  }
  async request(subject: string, providerAlreadyDeleted = false) {
    if (!subject) throw new SocialError(401, "Authentication required");
    const intent = await this.transaction(async (tx) => {
      // Share onboarding's identity lock, including identities without a User yet.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${subject}, 0))`;
      const user = await tx.user.findUnique({
        where: { clerkId: subject },
        select: { id: true },
      });
      const userId =
        user?.id ??
        `identity-${createHash("sha256").update(subject).digest("hex")}`;
      if (user) await this.lock(tx, [userId]);
      const existing = await tx.accountErasure.findUnique({
        where: { userId },
      });
      if (existing) return existing;
      const account = await tx.account.findUnique({
        where: { userId: userId },
      });
      if (
        !providerAlreadyDeleted &&
        account?.role === "FOUNDER" &&
        !(await tx.account.findFirst({
          where: {
            userId: { not: userId },
            role: "FOUNDER",
            status: "ACTIVE",
          },
          select: { userId: true },
        }))
      )
        throw new SocialError(
          409,
          "Assign another active founder before deleting this founder account. Contact support for help.",
        );
      const queued = await tx.accountErasure.upsert({
        where: { userId },
        update: {},
        create: {
          userId: userId,
          clerkId: subject,
          requestedAt: this.clock(),
          nextAttemptAt: this.clock(),
          providerDeletedAt: providerAlreadyDeleted ? this.clock() : null,
        },
      });
      await tx.account.updateMany({
        where: { userId: userId },
        data: { status: "DEACTIVATED", portraitPhotoId: null },
      });
      await tx.invitationLink.updateMany({
        where: { createdBy: userId },
        data: { revokedAt: this.clock() },
      });
      await tx.invitation.updateMany({
        where: { createdBy: userId, claimedBy: null },
        data: { revokedAt: this.clock() },
      });
      if (user) await pruneTopFriends(tx, userId);
      return queued;
    });
    // Do not acknowledge acceptance until a receipt exists outside DB snapshots.
    // If this fails, the intent remains private/retryable and the caller gets 503.
    await this.journal.write(journalRecord(intent));
  }

  private async removeContent(userId: string) {
    return this.transaction(async (tx) => {
      await this.lock(tx, [userId]);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) return true;
      // Match leaving a Space: prefer another administrator, then its oldest member.
      // Reassign before User's creator cascade can remove other members' content.
      const spaces = await tx.space.findMany({
        where: { creatorId: userId },
        take: 20,
        orderBy: { id: "asc" },
        select: { id: true },
      });
      for (const space of spaces) {
        await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${space.id} FOR UPDATE`;
        const successor = await tx.spaceMembership.findFirst({
          where: {
            spaceId: space.id,
            userId: { not: userId },
            user: { account: { is: { status: "ACTIVE" } } },
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { userId: "asc" }],
          select: { userId: true },
        });
        if (successor) {
          await tx.space.update({
            where: { id: space.id },
            data: { creatorId: successor.userId },
          });
          await tx.spaceMembership.update({
            where: {
              spaceId_userId: { spaceId: space.id, userId: successor.userId },
            },
            data: { role: "ADMIN" },
          });
        } else {
          await eraseSpace(tx, space.id, this.clock);
          await tx.space.delete({ where: { id: space.id } });
        }
      }
      await tx.account.updateMany({
        where: { userId },
        data: {
          status: "DEACTIVATED",
          displayName: "Deleted member",
          username: null,
          bio: "",
          portraitPhotoId: null,
        },
      });
      await tx.post.deleteMany({ where: { ownerId: userId } });
      await tx.postComment.deleteMany({ where: { authorId: userId } });
      await tx.memberMessage.deleteMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      });
      await tx.memberNotification.deleteMany({
        where: { OR: [{ actorId: userId }, { recipientId: userId }] },
      });
      await tx.galleryEntry.deleteMany({ where: { ownerId: userId } });
      await tx.postPhoto.deleteMany({ where: { ownerId: userId } });
      await tx.spacePhoto.deleteMany({ where: { photo: { ownerId: userId } } });
      await tx.photo.updateMany({
        where: { ownerId: userId, state: { not: "PURGED" } },
        data: { state: "DELETE_PENDING", description: "" },
      });
      await tx.friendship.deleteMany({
        where: { OR: [{ lowId: userId }, { highId: userId }] },
      });
      await tx.spaceMembership.deleteMany({ where: { userId } });
      await tx.spaceInvitation.deleteMany({
        where: { OR: [{ inviterId: userId }, { inviteeId: userId }] },
      });
      // Reports about/by the account and associated decisions may contain free-text
      // personal data. Erase these too; no automatic blanket safety-record exception.
      const relatedReport = {
        OR: [{ reporterId: userId }, { targetPersonId: userId }],
      };
      await tx.operatorAction.deleteMany({
        where: {
          OR: [
            { operatorId: userId },
            { targetId: userId },
            { report: { is: relatedReport } },
          ],
        },
      });
      await tx.safetyReport.deleteMany({ where: relatedReport });
      return !(await tx.space.findFirst({
        where: { creatorId: userId },
        select: { id: true },
      }));
    });
  }

  private async revokeInvitations(
    userId: string,
    provider: ErasureProvider,
    signal?: AbortSignal,
  ) {
    const rows = await this.db.invitation.findMany({
      where: { createdBy: userId, claimedBy: null, providerRevokedAt: null },
      orderBy: [
        { providerCheckedAt: { sort: "asc", nulls: "first" } },
        { id: "asc" },
      ],
      take: 20,
    });
    for (const row of rows) {
      signal?.throwIfAborted();
      await this.db.invitation.update({
        where: { id: row.id },
        data: { providerCheckedAt: this.clock() },
      });
      if (row.deliveryAttemptedAt || row.clerkInvitationId) {
        if (!row.email && !row.clerkInvitationId)
          throw Error("Invitation needs operator review");
        const matches = await provider.find(
          row.clerkInvitationId ?? row.email!,
        );
        const remote = matches.find((item) =>
          row.clerkInvitationId
            ? item.id === row.clerkInvitationId
            : item.publicMetadata?.marginInvitationId === row.id,
        );
        // An uncertain send can still appear later. Keep the reconciliation record.
        if (!remote && !row.clerkInvitationId) continue;
        if (remote?.status === "pending") await provider.revoke(remote.id);
      }
      await this.db.invitation.update({
        where: { id: row.id },
        data: { providerRevokedAt: this.clock() },
      });
    }
    return !(await this.db.invitation.findFirst({
      where: { createdBy: userId, claimedBy: null, providerRevokedAt: null },
      select: { id: true },
    }));
  }

  async process(provider: ErasureProvider, signal?: AbortSignal) {
    const now = this.clock();
    // A restored User must not regain access because its receipt says completed.
    await this.db
      .$executeRaw`UPDATE "AccountErasure" e SET "completedAt" = NULL, "providerDeletedAt" = NULL,
      "clerkId" = u."clerkId", "nextAttemptAt" = ${now}
      FROM "User" u WHERE e."userId" = u.id AND e."completedAt" IS NOT NULL`;
    const rows = await this.db.accountErasure.findMany({
      where: { completedAt: null, nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: "asc" }, { userId: "asc" }],
      take: 20,
    });
    let completed = 0;
    let failed = 0;
    for (const row of rows) {
      if (signal?.aborted) break;
      // Commit retry rotation before external calls, including an interrupted worker.
      await this.db.accountErasure.update({
        where: { userId: row.userId },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt: new Date(now.getTime() + 60_000),
        },
      });
      try {
        await this.journal.write(journalRecord(row));
        const contentRemoved = await this.removeContent(row.userId);
        const invitationsRevoked = await this.revokeInvitations(
          row.userId,
          provider,
          signal,
        );
        if (!row.providerDeletedAt) {
          if (!row.clerkId) throw Error("Provider deletion identity missing");
          await provider.deleteUser(row.clerkId);
          await this.db.accountErasure.update({
            where: { userId: row.userId },
            data: { providerDeletedAt: this.clock() },
          });
        }
        const pendingPhoto = await this.db.photo.findFirst({
          where: { ownerId: row.userId, state: { not: "PURGED" } },
          select: { id: true },
        });
        if (!contentRemoved || !invitationsRevoked || pendingPhoto) continue;
        signal?.throwIfAborted();
        const completedAt = this.clock();
        await this.journal.write({
          ...journalRecord(row),
          clerkId: null,
          providerDeletedAt:
            row.providerDeletedAt?.toISOString() ?? completedAt.toISOString(),
          completedAt: completedAt.toISOString(),
        });
        const removed = await this.transaction(async (tx) => {
          await this.lock(tx, [row.userId]);
          if (
            await tx.photo.findFirst({
              where: { ownerId: row.userId, state: { not: "PURGED" } },
              select: { id: true },
            })
          )
            return false;
          // Invitation identity strings are deliberately not relational. Clear
          // claims issued to this identity and owned links before deleting User.
          const ownedLinks = { createdBy: row.userId };
          await tx.invitation.deleteMany({
            where: {
              OR: [
                ownedLinks,
                { claimedBy: row.clerkId ?? "" },
                { founderSubject: row.clerkId ?? "" },
                { link: { is: ownedLinks } },
              ],
            },
          });
          await tx.invitationLink.deleteMany({ where: ownedLinks });
          await tx.user.deleteMany({ where: { id: row.userId } });
          await tx.accountErasure.update({
            where: { userId: row.userId },
            data: { clerkId: null, completedAt },
          });
          return true;
        });
        if (removed) completed++;
      } catch {
        // No identifiers, provider errors or private content leave this boundary.
        failed++;
      }
    }
    const expired = await this.db.accountErasure.findMany({
      where: {
        completedAt: {
          lt: new Date(now.getTime() - ERASURE_RECEIPT_DAYS * 86_400_000),
        },
      },
      take: 100,
      select: { userId: true },
    });
    for (const row of expired) {
      signal?.throwIfAborted();
      await this.journal.delete(erasureReceiptKey(row.userId));
      await this.db
        .$executeRaw`DELETE FROM "AccountErasure" e WHERE e."userId" = ${row.userId}
        AND e."completedAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = e."userId")`;
    }
    if (failed) throw Error("Account erasure needs retry");
    const pending = await this.db.accountErasure.count({
      where: { completedAt: null },
    });
    return {
      checked: rows.length,
      completed,
      pending,
      receiptsErased: expired.length,
    };
  }
}
