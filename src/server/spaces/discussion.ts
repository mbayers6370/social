import "server-only";
import { memberPerson } from "@/lib/member-person";
import type { SpaceComments } from "@/features/spaces/contracts";
import { commentInput } from "@/features/spaces/schema";
import { SocialService } from "@/server/social/service";
import { unavailable } from "@/server/social/errors";
import { unblockedAuthor } from "./access";

export class SpaceDiscussionService extends SocialService {
  async comments(
    subject: string,
    postId: string,
    after?: string,
    atComment?: string,
  ): Promise<SpaceComments> {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, expiresAt: { gt: this.clock() } },
        select: {
          id: true,
          ownerId: true,
          spaceId: true,
          space: { select: { archivedAt: true } },
        },
      });
      if (!post) throw unavailable();
      await this.lock(tx, [actor, post.ownerId]);
      await this.postAudience(tx, actor, post);
      const where = { postId, author: unblockedAuthor(actor) };
      const target = atComment
        ? await tx.postComment.findFirst({
            where: { ...where, id: atComment },
            select: { id: true, replyToId: true },
          })
        : null;
      if (atComment && !target) throw unavailable();
      const anchor = after
        ? await tx.postComment.findFirst({
            where: { ...where, id: after },
            select: { id: true, createdAt: true },
          })
        : null;
      if (after && !anchor) throw unavailable();
      const select = {
        id: true,
        body: true,
        createdAt: true,
        replyToId: true,
        author: {
          select: {
            id: true,
            account: { select: { displayName: true, portraitPhotoId: true } },
          },
        },
      } as const;
      const rows = await tx.postComment.findMany({
        where: {
          ...where,
          ...(anchor
            ? {
                OR: [
                  { createdAt: { lt: anchor.createdAt } },
                  { createdAt: anchor.createdAt, id: { lt: anchor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
        select,
      });
      // Include a bounded target and its immediate parent without walking every
      // intervening page. Every row retains the same post and author scope.
      const context = target
        ? await tx.postComment.findMany({
            where: {
              ...where,
              id: {
                in: [
                  target.id,
                  ...(target.replyToId ? [target.replyToId] : []),
                ],
              },
            },
            select,
          })
        : [];
      const comments = [
        ...new Map(
          [...rows.slice(0, 20), ...context].map((c) => [c.id, c]),
        ).values(),
      ].sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
      const viewer = await tx.account.findUniqueOrThrow({
        where: { userId: actor },
        select: { displayName: true, portraitPhotoId: true },
      });
      return {
        comments: comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: memberPerson(c.author.id, c.author.account!),
          ...(c.replyToId ? { replyTo: c.replyToId } : {}),
        })),
        nextCursor: rows.length > 20 ? rows[19].id : null,
        readOnly: Boolean(post.space?.archivedAt),
        liked: !!(await tx.postLike.findUnique({
          where: { postId_userId: { postId, userId: actor } },
          select: { userId: true },
        })),
        likeCount: await tx.postLike.count({ where: { postId } }),
        viewer: memberPerson(actor, viewer),
      };
    });
  }

  async comment(subject: string, postId: string, raw: unknown) {
    const input = commentInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, expiresAt: { gt: this.clock() } },
        select: { ownerId: true, spaceId: true },
      });
      if (!post) throw unavailable();
      await this.lock(tx, [actor, post.ownerId]);
      await this.postAudience(tx, actor, post, true);
      if (
        input.replyTo &&
        !(await tx.postComment.findFirst({
          where: { id: input.replyTo, postId, author: unblockedAuthor(actor) },
          select: { id: true },
        }))
      )
        throw unavailable();
      const saved = await tx.postComment.create({
        data: {
          postId,
          authorId: actor,
          body: input.body,
          createdAt: this.clock(),
          replyToId: input.replyTo,
        },
        select: { id: true },
      });
      await this.notify(
        tx,
        post.ownerId,
        actor,
        "comment",
        `comment:${saved.id}`,
        postId,
      );
      if (input.replyTo) {
        const parent = await tx.postComment.findUnique({
          where: { id: input.replyTo },
          select: { authorId: true },
        });
        if (parent && parent.authorId !== post.ownerId)
          await this.notify(
            tx,
            parent.authorId,
            actor,
            "reply",
            `reply:${saved.id}`,
            postId,
          );
      }
      return saved;
    });
  }
}
