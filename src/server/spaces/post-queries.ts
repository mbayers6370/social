import "server-only";
import { memberPerson } from "@/lib/member-person";
import type { SpacePostPage } from "@/features/spaces/contracts";
import { Prisma } from "@/generated/prisma/client";
import { liveSpaceWhere } from "./access";
import { SocialService } from "@/server/social/service";
import { unavailable } from "@/server/social/errors";
import { spaceAccess, unblockedAuthor } from "./access";

export class SpacePostQueryService extends SocialService {
  private async postPage(
    tx: Prisma.TransactionClient,
    actor: string,
    where: Prisma.PostWhereInput,
    before?: string,
    atPost?: string,
  ): Promise<SpacePostPage> {
    const visible: Prisma.PostWhereInput = {
      AND: [
        where,
        { OR: [{ spaceId: null }, { space: liveSpaceWhere(this.clock()) }] },
        {
          deletedAt: null,
          expiresAt: { gt: this.clock() },
          owner: unblockedAuthor(actor),
        },
      ],
    };
    const anchor =
      before || atPost
        ? await tx.post.findFirst({
            where: { AND: [visible, { id: before ?? atPost }] },
            select: { id: true, createdAt: true },
          })
        : null;
    if ((before || atPost) && !anchor) throw unavailable();
    const rows = await tx.post.findMany({
      where: {
        AND: [
          visible,
          ...(anchor
            ? [
                {
                  OR: [
                    { createdAt: { lt: anchor.createdAt } },
                    {
                      createdAt: anchor.createdAt,
                      id: atPost ? { lte: anchor.id } : { lt: anchor.id },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      select: {
        id: true,
        body: true,
        createdAt: true,
        expiresAt: true,
        owner: {
          select: {
            id: true,
            account: { select: { displayName: true, portraitPhotoId: true } },
          },
        },
        space: { select: { id: true, name: true, archivedAt: true } },
        photos: {
          where: { photo: { state: "READY" } },
          select: {
            photo: {
              select: {
                id: true,
                description: true,
                width: true,
                height: true,
              },
            },
          },
        },
      },
    });
    return {
      posts: rows.slice(0, 20).map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        author: memberPerson(p.owner.id, p.owner.account!),
        space: p.space
          ? {
              id: p.space.id,
              name: p.space.name,
              archived: Boolean(p.space.archivedAt),
            }
          : null,
        photos: p.photos.map((r) => r.photo),
      })),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }

  async posts(subject: string, id: string, before?: string, atPost?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await spaceAccess(tx, actor, id, false, this.clock());
      return this.postPage(tx, actor, { spaceId: id }, before, atPost);
    });
  }

  async feed(subject: string, before?: string, includeEvents = true) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const friends = await tx.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ lowId: actor }, { highId: actor }],
        },
        select: { lowId: true, highId: true },
      });
      const page = await this.postPage(
        tx,
        actor,
        {
          OR: [
            {
              spaceId: null,
              ownerId: {
                in: friends.map((p) =>
                  p.lowId === actor ? p.highId : p.lowId,
                ),
              },
            },
            {
              ownerId: { not: actor },
              space: {
                deletedAt: null,
                ...(!includeEvents ? { kind: { not: "EVENT" as const } } : {}),
                memberships: { some: { userId: actor, includeInFeed: true } },
              },
            },
          ],
        },
        before,
      );
      return { ...page, hasFriends: friends.length > 0 };
    });
  }
}
