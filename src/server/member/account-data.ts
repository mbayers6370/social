import "server-only";
import { readTopFriends } from "./top-friends";
import { ownedReadablePhotos } from "./photo-visibility";
import { SocialError } from "@/server/social/errors";
import { profileTrackFromRow } from "@/server/music/selections";
import { messageCutoff } from "@/lib/message-policy";
import { SocialService } from "@/server/social/service";

export class MemberAccountDataService extends SocialService {
  async safety(subject: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const blocked = await tx.block.findMany({
        where: { blockerId: actor },
        select: {
          blocked: {
            select: { id: true, account: { select: { displayName: true } } },
          },
        },
        take: 100,
      });
      const reports = await tx.safetyReport.findMany({
        where: { reporterId: actor },
        select: {
          id: true,
          reason: true,
          status: true,
          targetKind: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return {
        blocked: blocked.map((row) => ({
          id: row.blocked.id,
          name: row.blocked.account?.displayName ?? "Margin member",
        })),
        reports: reports.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    });
  }

  async exportAccount(subject: string) {
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      const profile = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: {
          displayName: true,
          username: true,
          bio: true,
          readingSize: true,
          motion: true,
          usernameChangedAt: true,
          portraitPhotoId: true,
          notifyComments: true,
          notifyFriends: true,
          notifyLikes: true,
          notifyMessages: true,
          messagingEnabled: true,
          showTopFriends: true,
        },
      });
      // Export only this member's records; no session, provider credentials,
      // private object keys, unaccepted profiles, or other people's reports.
      const posts = await tx.post.findMany({
        where: {
          ownerId: id,
          deletedAt: null,
          expiresAt: { gt: this.clock() },
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          expiresAt: true,
          spaceId: true,
        },
        take: 10001,
      });
      const photos = await tx.photo.findMany({
        where: ownedReadablePhotos(id, this.clock()),
        select: {
          id: true,
          description: true,
          createdAt: true,
          width: true,
          height: true,
        },
        take: 10001,
      });
      const messages = await tx.memberMessage.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  senderId: id,
                  recipientId: id,
                  createdAt: { gt: messageCutoff(this.clock(), true) },
                },
                {
                  NOT: { senderId: id, recipientId: id },
                  createdAt: { gt: messageCutoff(this.clock()) },
                },
              ],
            },
          ],
          OR: [
            { senderId: id, hiddenBySender: false },
            { recipientId: id, hiddenByRecipient: false },
          ],
        },
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          body: true,
          createdAt: true,
        },
        take: 10001,
      });
      if (
        messages.length > 10000 ||
        posts.length > 10000 ||
        photos.length > 10000
      )
        throw new SocialError(
          409,
          "This account needs an assisted export. Contact support@margin.social.",
        );
      const gallery = await tx.galleryEntry.findMany({
        where: { ownerId: id },
        select: { photoId: true, featured: true, position: true },
        orderBy: { position: "asc" },
      });
      const music = (
        await tx.profileSong.findMany({
          where: { userId: id },
          orderBy: { position: "asc" },
        })
      ).map(profileTrackFromRow);
      const comments = await tx.postComment.findMany({
        where: {
          authorId: id,
          post: { deletedAt: null, expiresAt: { gt: this.clock() } },
        },
        select: {
          id: true,
          postId: true,
          body: true,
          replyToId: true,
          createdAt: true,
        },
        take: 10001,
      });
      const likes = await tx.postLike.findMany({
        where: { userId: id },
        select: { postId: true, createdAt: true },
        take: 10001,
      });
      const friendships = await tx.friendship.findMany({
        where: { OR: [{ lowId: id }, { highId: id }] },
        take: 10001,
      });
      const blocked = await tx.block.findMany({
        where: { blockerId: id },
        select: { blockedId: true },
        take: 10001,
      });
      const reports = await tx.safetyReport.findMany({
        where: { reporterId: id },
        select: {
          id: true,
          reason: true,
          details: true,
          targetKind: true,
          targetId: true,
          status: true,
          createdAt: true,
        },
        take: 10001,
      });
      const notifications = await tx.memberNotification.findMany({
        where: { recipientId: id },
        select: {
          id: true,
          kind: true,
          actorId: true,
          postId: true,
          createdAt: true,
          readAt: true,
        },
        take: 10001,
      });
      if (
        [comments, likes, friendships, blocked, reports, notifications].some(
          (rows) => rows.length > 10000,
        )
      )
        throw new SocialError(
          409,
          "This account needs an assisted export. Contact support@margin.social.",
        );
      return {
        topFriends: await readTopFriends(tx, id),
        exportedAt: this.clock().toISOString(),
        profile,
        music,
        posts,
        photos,
        gallery,
        messages,
        comments,
        likes,
        friendships,
        blocked,
        reports,
        notifications,
      };
    });
  }
}
