import "server-only";
import { pruneTopFriends } from "@/server/member/top-friends";
import type { Prisma } from "@/generated/prisma/client";
import { SocialService } from "@/server/social/service";
import { SocialError, unavailable } from "@/server/social/errors";
import { liveSpaceWhere } from "@/server/spaces/access";
import {
  releaseSpacePhotoReferences,
  retireUnreferencedPhotos,
} from "@/server/spaces/media-lifecycle";
import { messageCutoff } from "@/lib/message-policy";
import {
  moderationDecision,
  eventAdminAssignment,
} from "@/features/safety/moderation-schema";

/** Founder access is purpose-limited to submitted reports, never a private-content browser. */
export class ModerationService extends SocialService {
  private async founder(tx: Prisma.TransactionClient, subject: string) {
    const actor = await this.actor(tx, subject);
    await this.lock(tx, [actor]);
    const account = await tx.account.findUniqueOrThrow({
      where: { userId: actor },
      select: { role: true, status: true },
    });
    if (account.status !== "ACTIVE" || account.role !== "FOUNDER")
      throw new SocialError(403, "Founder access required");
    return actor;
  }

  async reports(subject: string, before?: string) {
    return this.transaction(async (tx) => {
      await this.founder(tx, subject);
      const reports = await tx.safetyReport.findMany({
        where: before ? { id: { lt: before } } : {},
        orderBy: { id: "desc" },
        take: 21,
        select: {
          id: true,
          targetKind: true,
          targetId: true,
          targetPersonId: true,
          reason: true,
          details: true,
          status: true,
          createdAt: true,
          review: { select: { action: true, note: true, createdAt: true } },
        },
      });
      return {
        reports: reports.slice(0, 20),
        nextCursor: reports.length > 20 ? reports[19].id : null,
      };
    });
  }

  private async target(
    tx: Prisma.TransactionClient,
    report: { targetKind: string; targetId: string; targetPersonId: string },
  ) {
    if (report.targetKind === "post") {
      const post = await tx.post.findFirst({
        where: {
          id: report.targetId,
          ownerId: report.targetPersonId,
          deletedAt: null,
          expiresAt: { gt: this.clock() },
          OR: [{ spaceId: null }, { space: liveSpaceWhere(this.clock()) }],
        },
        select: {
          id: true,
          body: true,
          spaceId: true,
          photos: {
            where: { photo: { state: "READY" } },
            select: { photoId: true },
          },
        },
      });
      return post
        ? {
            body: post.body,
            photos: post.photos.map((p) => p.photoId),
            spaceId: post.spaceId,
          }
        : null;
    }
    if (report.targetKind === "message") {
      const message = await tx.memberMessage.findFirst({
        where: {
          id: report.targetId,
          senderId: report.targetPersonId,
          createdAt: { gt: messageCutoff(this.clock()) },
          NOT: { hiddenBySender: true, hiddenByRecipient: true },
        },
        select: { body: true },
      });
      return message
        ? { body: message.body, photos: [] as string[], spaceId: null }
        : null;
    }
    if (report.targetKind === "profile") {
      const account = await tx.account.findUnique({
        where: { userId: report.targetPersonId },
        select: { displayName: true, bio: true, portraitPhotoId: true },
      });
      return account
        ? {
            body: `${account.displayName}\n${account.bio}`,
            photos: account.portraitPhotoId ? [account.portraitPhotoId] : [],
            spaceId: null,
          }
        : null;
    }
    return null;
  }

  async report(subject: string, id: string) {
    return this.transaction(async (tx) => {
      await this.founder(tx, subject);
      const report = await tx.safetyReport.findUnique({
        where: { id },
        select: {
          id: true,
          targetKind: true,
          targetId: true,
          targetPersonId: true,
        },
      });
      if (!report) throw unavailable();
      return { target: await this.target(tx, report) };
    });
  }

  async reportPhoto(subject: string, id: string, photoId: string) {
    return this.transaction(async (tx) => {
      await this.founder(tx, subject);
      const report = await tx.safetyReport.findUnique({ where: { id } });
      if (!report || !(await this.target(tx, report))?.photos.includes(photoId))
        throw unavailable();
      const photo = await tx.photo.findFirst({
        where: { id: photoId, ownerId: report.targetPersonId, state: "READY" },
        select: { objectKey: true },
      });
      if (!photo) throw unavailable();
      return this.store.get(photo.objectKey);
    });
  }

  async review(subject: string, id: string, raw: unknown) {
    const input = moderationDecision.parse(raw);
    return this.transaction(async (tx) => {
      const operatorId = await this.founder(tx, subject);
      await tx.$queryRaw`SELECT id FROM "SafetyReport" WHERE id = ${id} FOR UPDATE`;
      const report = await tx.safetyReport.findUnique({ where: { id } });
      if (!report) throw unavailable();
      if (report.status !== "RECEIVED")
        throw new SocialError(409, "This report has already been reviewed.");
      await this.lock(tx, [report.targetPersonId]);
      const target = await this.target(tx, report);
      if (input.action === "REMOVE_POST") {
        if (report.targetKind !== "post" || !target) throw unavailable();
        if (target.spaceId)
          await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${target.spaceId} FOR UPDATE`;
        await tx.post.delete({ where: { id: report.targetId } });
        if (target.spaceId)
          await releaseSpacePhotoReferences(tx, target.spaceId, this.clock());
        await retireUnreferencedPhotos(tx, target.photos, this.clock());
      } else if (input.action === "REMOVE_MESSAGE") {
        if (report.targetKind !== "message" || !target) throw unavailable();
        await tx.memberMessage.update({
          where: { id: report.targetId },
          data: {
            body: "[Removed]",
            hiddenBySender: true,
            hiddenByRecipient: true,
          },
        });
      } else if (input.action === "REMOVE_PHOTO") {
        if (!input.photoId || !target?.photos.includes(input.photoId))
          throw unavailable();
        const spaces = await tx.space.findMany({
          where: {
            OR: [
              { photos: { some: { photoId: input.photoId } } },
              {
                posts: {
                  some: { photos: { some: { photoId: input.photoId } } },
                },
              },
            ],
          },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        for (const space of spaces)
          await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${space.id} FOR UPDATE`;
        // Operator removal overrides archived placement, but retains quota markers and retryable object cleanup.
        await tx.account.updateMany({
          where: { portraitPhotoId: input.photoId },
          data: { portraitPhotoId: null },
        });
        await tx.galleryEntry.deleteMany({ where: { photoId: input.photoId } });
        await tx.postPhoto.deleteMany({ where: { photoId: input.photoId } });
        await tx.spacePhoto.deleteMany({ where: { photoId: input.photoId } });
        await tx.photo.update({
          where: { id: input.photoId },
          data: { state: "DELETE_PENDING" },
        });
        await tx.account.update({
          where: { userId: report.targetPersonId },
          data: { galleryVersion: { increment: 1 } },
        });
      } else if (input.action === "DEACTIVATE_ACCOUNT") {
        const targetAccount = await tx.account.findUnique({
          where: { userId: report.targetPersonId },
          select: { role: true },
        });
        if (
          !targetAccount ||
          targetAccount.role === "FOUNDER" ||
          report.targetPersonId === operatorId
        )
          throw new SocialError(
            403,
            "Founder accounts require a separate operator recovery process.",
          );
        await tx.account.update({
          where: { userId: report.targetPersonId },
          data: { status: "DEACTIVATED" },
        });
        await pruneTopFriends(tx, report.targetPersonId);
      }
      await tx.operatorAction.create({
        data: {
          operatorId,
          reportId: id,
          action: input.action,
          targetId: input.photoId ?? report.targetId,
          note: input.note,
          createdAt: this.clock(),
        },
      });
      return tx.safetyReport.update({
        where: { id },
        data: { status: input.action === "DISMISS" ? "DISMISSED" : "ACTIONED" },
        select: { id: true, status: true },
      });
    });
  }

  async assignEventAdmin(subject: string, spaceId: string, raw: unknown) {
    const input = eventAdminAssignment.parse(raw);
    return this.transaction(async (tx) => {
      const operatorId = await this.founder(tx, subject);
      await this.lock(tx, [input.userId]);
      await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${spaceId} FOR UPDATE`;
      const space = await tx.space.findFirst({
        where: {
          id: spaceId,
          kind: "EVENT",
          ...liveSpaceWhere(this.clock()),
          archivedAt: null,
        },
        select: { id: true },
      });
      const account = await tx.account.findFirst({
        where: { userId: input.userId, status: "ACTIVE" },
        select: { userId: true },
      });
      const member = await tx.spaceMembership.findUnique({
        where: { spaceId_userId: { spaceId, userId: input.userId } },
      });
      if (!space || !account || !member) throw unavailable();
      await tx.spaceMembership.update({
        where: { spaceId_userId: { spaceId, userId: input.userId } },
        data: { role: input.role },
      });
      if (input.role === "MEMBER")
        await tx.spaceInvitation.deleteMany({
          where: { spaceId, inviterId: input.userId, acceptedAt: null },
        });
      await tx.operatorAction.create({
        data: {
          operatorId,
          action:
            input.role === "ADMIN"
              ? "EVENT_ADMIN_ASSIGN"
              : "EVENT_ADMIN_REMOVE",
          targetId: `${spaceId}:${input.userId}`,
          note: input.note,
          createdAt: this.clock(),
        },
      });
      return { saved: true };
    });
  }
}
