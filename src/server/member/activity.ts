import "server-only";
import {
  missingSpaceInvitationNotifications,
  spaceInvitationId,
  spaceInvitationNotificationKey,
  visibleSpaceInvitation,
} from "@/server/spaces/invitation-notifications";
import { SocialError } from "@/server/social/errors";
import { memberPerson } from "@/lib/member-person";
import type { MemberActivity } from "@/features/social/member-contracts";
import { messageCutoff } from "@/lib/message-policy";
import { SocialService } from "@/server/social/service";
import { accountSelect, unavailable, pair } from "./selectors";

export class MemberActivityService extends SocialService {
  async like(subject: string, postId: string, liked: boolean) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, expiresAt: { gt: this.clock() } },
        select: { id: true, ownerId: true, spaceId: true },
      });
      if (!post) throw unavailable();
      await this.lock(tx, [actor, post.ownerId]);
      await this.postAudience(tx, actor, post, true);
      if (liked) {
        await tx.postLike.upsert({
          where: { postId_userId: { postId, userId: actor } },
          create: { postId, userId: actor },
          update: {},
        });
        if (actor !== post.ownerId)
          await this.notify(
            tx,
            post.ownerId,
            actor,
            "like",
            `like:${postId}:${actor}`,
            postId,
          );
      } else {
        await tx.postLike.deleteMany({ where: { postId, userId: actor } });
        await tx.memberNotification.deleteMany({
          where: { dedupeKey: `like:${postId}:${actor}` },
        });
      }
      return { liked, count: await tx.postLike.count({ where: { postId } }) };
    });
  }

  async notifications(subject: string, before?: string, includeEvents = true) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      if (!before) {
        const missing = await missingSpaceInvitationNotifications(
          tx,
          actor,
          this.clock(),
        );
        for (const invitation of missing) {
          await this.notify(
            tx,
            actor,
            invitation.inviterId,
            "space_invitation",
            spaceInvitationNotificationKey(invitation.id),
          );
        }
      }
      const settings = await tx.account.findUniqueOrThrow({
        where: { userId: actor },
      });
      const rows = await tx.memberNotification.findMany({
        where: {
          recipientId: actor,
          ...(before ? { id: { lt: before } } : {}),
        },
        include: {
          actor: { select: { id: true, account: { select: accountSelect } } },
          post: {
            select: {
              id: true,
              ownerId: true,
              spaceId: true,
              deletedAt: true,
              expiresAt: true,
              space: { select: { name: true, kind: true } },
            },
          },
        },
        orderBy: { id: "desc" },
        take: 51,
      });
      const activity: MemberActivity[] = [];
      for (const row of rows.slice(0, 50)) {
        if (!includeEvents && row.post?.space?.kind === "EVENT") continue;
        if (!row.actor.account || (await this.blocked(tx, actor, row.actorId)))
          continue;
        if (
          row.kind === "message" &&
          !(await tx.memberMessage.findFirst({
            where: {
              id: row.dedupeKey.startsWith("message:")
                ? row.dedupeKey.slice(8)
                : "",
              senderId: row.actorId,
              recipientId: actor,
              hiddenByRecipient: false,
              createdAt: { gt: messageCutoff(this.clock()) },
            },
            select: { id: true },
          }))
        )
          continue;
        if (
          (row.kind === "message" &&
            (!settings.notifyMessages ||
              !settings.messagingEnabled ||
              !row.actor.account.messagingEnabled)) ||
          (row.kind === "like" && !settings.notifyLikes) ||
          (["comment", "reply"].includes(row.kind) &&
            !settings.notifyComments) ||
          (row.kind.startsWith("friend_") && !settings.notifyFriends)
        )
          continue;
        if (row.kind === "space_invitation") {
          const id = spaceInvitationId(row.dedupeKey);
          const invitation = id
            ? await visibleSpaceInvitation(
                tx,
                actor,
                id,
                this.clock(),
                row.actorId,
              )
            : null;
          if (
            !invitation ||
            (!includeEvents && invitation.space.kind === "EVENT")
          )
            continue;
          activity.push({
            id: row.id,
            actor: memberPerson(row.actor.id, row.actor.account),
            kind: "space_invitation",
            invitation: {
              id: invitation.id,
              space: { name: invitation.space.name },
            },
            href: "/app/spaces#space-invitations",
            createdAt: row.createdAt.toISOString(),
            read: row.readAt !== null,
          });
          continue;
        }
        if (row.post) {
          if (
            row.kind === "space_post" &&
            (!row.post.space || row.post.space.kind === "EVENT")
          )
            continue;
          if (row.post.deletedAt || row.post.expiresAt <= this.clock())
            continue;
          try {
            await this.postAudience(tx, actor, row.post);
          } catch (error) {
            if (
              error instanceof SocialError &&
              [403, 404].includes(error.status)
            )
              continue;
            throw error;
          }
        }
        if (row.kind.startsWith("friend_")) {
          const friendship = await tx.friendship.findUnique({
            where: { lowId_highId: pair(actor, row.actorId) },
          });
          if (
            row.kind === "friend_request"
              ? !friendship ||
                friendship.status !== "PENDING" ||
                friendship.requesterId === actor
              : friendship?.status !== "ACCEPTED"
          )
            continue;
        }
        const kind = row.kind as MemberActivity["kind"];
        const commentId = ["comment", "reply"].includes(kind)
          ? row.dedupeKey.match(
              /^(?:comment|reply):([A-Za-z0-9_-]{1,128})$/,
            )?.[1]
          : undefined;
        if (
          ["comment", "reply"].includes(kind) &&
          (!row.post ||
            !commentId ||
            !(await tx.postComment.findFirst({
              where: {
                id: commentId,
                postId: row.post.id,
                authorId: row.actorId,
                author: { account: { is: { status: "ACTIVE" } } },
              },
              select: { id: true },
            })))
        )
          continue;
        const postQuery = row.post
          ? new URLSearchParams({
              post: row.post.id,
              ...(commentId ? { comment: commentId } : {}),
            })
          : null;
        activity.push({
          id: row.id,
          actor: memberPerson(row.actor.id, row.actor.account),
          kind,
          ...(kind === "space_post" && row.post?.space
            ? { spaceName: row.post.space.name }
            : {}),
          href:
            row.kind === "message"
              ? `/app/messages?thread=${encodeURIComponent(row.actorId)}`
              : row.post
                ? row.post.spaceId
                  ? `/app/spaces/${encodeURIComponent(row.post.spaceId)}?${postQuery}#${encodeURIComponent(row.post.id)}`
                  : `/app?person=${encodeURIComponent(row.post.ownerId)}&${postQuery}#${encodeURIComponent(row.post.id)}`
                : `/app?person=${encodeURIComponent(row.actorId)}`,
          createdAt: row.createdAt.toISOString(),
          read: row.readAt !== null,
        });
      }
      return { activity, nextCursor: rows.length > 50 ? rows[49].id : null };
    });
  }

  async readNotifications(subject: string, id?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await tx.memberNotification.updateMany({
        where: { recipientId: actor, readAt: null, ...(id ? { id } : {}) },
        data: { readAt: this.clock() },
      });
      return { saved: true };
    });
  }
}
