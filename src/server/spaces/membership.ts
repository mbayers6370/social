import "server-only";
import { memberPerson } from "@/lib/member-person";
import type { SpaceInvitationCandidates } from "@/features/spaces/contracts";
import { Prisma } from "@/generated/prisma/client";
import { spaceInvitationNotificationKey } from "./invitation-notifications";
import { SocialService } from "@/server/social/service";
import { SocialError, unavailable } from "@/server/social/errors";
import {
  spaceAccess,
  requireSpaceAdmin,
  unblockedAuthor,
  acceptedFriendOf,
} from "./access";
import {
  spaceInvitationSearch,
  memberInput,
  type MemberInput,
} from "@/features/spaces/schema";
import { eraseSpace } from "./lifecycle";

export class SpaceMembershipService extends SocialService {
  async invitationCandidates(
    subject: string,
    spaceId: string,
    rawQuery = "",
  ): Promise<SpaceInvitationCandidates> {
    const term = spaceInvitationSearch.parse(rawQuery);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      requireSpaceAdmin(
        await spaceAccess(tx, actor, spaceId, true, this.clock()),
      );
      const friend = acceptedFriendOf(actor);
      const eligible: Prisma.UserWhereInput = {
        ...unblockedAuthor(actor),
        AND: [friend],
        id: { not: actor },
        memberships: { none: { spaceId } },
        spaceInvitesReceived: {
          none: {
            spaceId,
            acceptedAt: null,
            expiresAt: { gt: this.clock() },
            inviter: {
              account: { is: { status: "ACTIVE" } },
              memberships: { some: { spaceId, role: "ADMIN" } },
            },
          },
        },
        ...(term
          ? {
              OR: [
                {
                  account: {
                    is: {
                      displayName: { contains: term, mode: "insensitive" },
                    },
                  },
                },
                {
                  account: {
                    is: { username: { contains: term, mode: "insensitive" } },
                  },
                },
              ],
            }
          : {}),
      };
      const select = {
        id: true,
        account: {
          select: {
            displayName: true,
            username: true,
            portraitPhotoId: true,
            portraitCrop: true,
          },
        },
      } as const;
      const orderBy: Prisma.UserOrderByWithRelationInput[] = [
        { account: { displayName: "asc" } },
        { id: "asc" },
      ];
      // Filter friendship in SQL, before limiting or exposing introduction fields.
      const friends = await tx.user.findMany({
        where: eligible,
        select,
        orderBy,
        take: 21,
      });
      const rows = friends.map((row) => ({ row, friend: true }));
      return {
        members: rows.slice(0, 20).map(({ row, friend }) => ({
          person: memberPerson(row.id, row.account!),
          username: row.account!.username ?? "",
          friend,
        })),
        hasMore: rows.length > 20,
      };
    });
  }

  async invite(subject: string, spaceId: string, targetId: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor, targetId]);
      requireSpaceAdmin(
        await spaceAccess(tx, actor, spaceId, true, this.clock()),
      );
      if (
        actor === targetId ||
        !(await tx.user.findFirst({
          where: { id: targetId, ...unblockedAuthor(actor) },
          select: { id: true },
        }))
      )
        throw unavailable();
      const friendship = await tx.friendship.findUnique({
        where: {
          lowId_highId:
            actor < targetId
              ? { lowId: actor, highId: targetId }
              : { lowId: targetId, highId: actor },
        },
      });
      if (friendship?.status !== "ACCEPTED")
        throw new SocialError(
          403,
          "Only accepted friends can receive Space invitations.",
        );
      if (
        await tx.spaceMembership.findUnique({
          where: { spaceId_userId: { spaceId, userId: targetId } },
        })
      )
        throw new SocialError(409, "Already a member");
      const existing = await tx.spaceInvitation.findFirst({
        where: {
          spaceId,
          inviteeId: targetId,
          acceptedAt: null,
          inviterId: actor,
          expiresAt: { gt: this.clock() },
        },
        select: { id: true },
      });
      const invitation =
        existing ??
        (await tx.spaceInvitation.create({
          data: {
            spaceId,
            inviterId: actor,
            inviteeId: targetId,
            expiresAt: new Date(this.clock().getTime() + 7 * 86400_000),
          },
          select: { id: true },
        }));
      await this.notify(
        tx,
        targetId,
        actor,
        "space_invitation",
        spaceInvitationNotificationKey(invitation.id),
      );
      return invitation;
    });
  }

  async accept(subject: string, invitationId: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const invitation = await tx.spaceInvitation.findUnique({
        where: { id: invitationId },
      });
      if (
        !invitation ||
        invitation.inviteeId !== actor ||
        invitation.expiresAt <= this.clock()
      )
        throw unavailable();
      await this.lock(tx, [actor, invitation.inviterId]);
      const inviter = await spaceAccess(
        tx,
        invitation.inviterId,
        invitation.spaceId,
        true,
        this.clock(),
      );
      requireSpaceAdmin(inviter);
      if (
        !(await tx.user.findFirst({
          where: {
            id: invitation.inviterId,
            ...unblockedAuthor(actor),
            ...acceptedFriendOf(actor),
          },
          select: { id: true },
        }))
      )
        throw unavailable();
      const current = await tx.spaceMembership.findUnique({
        where: {
          spaceId_userId: { spaceId: invitation.spaceId, userId: actor },
        },
      });
      if (invitation.acceptedAt && !current) throw unavailable();
      await tx.spaceMembership.upsert({
        where: {
          spaceId_userId: { spaceId: invitation.spaceId, userId: actor },
        },
        create: { spaceId: invitation.spaceId, userId: actor },
        update: {},
      });
      await tx.spaceInvitation.updateMany({
        where: {
          spaceId: invitation.spaceId,
          inviteeId: actor,
          acceptedAt: null,
        },
        data: { acceptedAt: this.clock() },
      });
      return { id: invitation.spaceId };
    });
  }

  async member(subject: string, id: string, raw: MemberInput) {
    const input = memberInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const self = await spaceAccess(tx, actor, id, false, this.clock());
      // Viewing preference remains personal and available on an archived event.
      if (input.action === "preferences") {
        await tx.spaceMembership.update({
          where: { spaceId_userId: { spaceId: id, userId: actor } },
          data: { includeInFeed: input.includeInFeed },
        });
        return;
      }
      // Leaving withdraws this member's access; it does not edit archived content.
      const leaving = input.action === "remove" && input.userId === actor;
      if (self.space.archivedAt && !leaving)
        throw new SocialError(409, "This Space is archived and read-only");
      if (input.action === "rsvp-settings") {
        requireSpaceAdmin(self);
        await tx.space.update({
          where: { id },
          data: { rsvpEnabled: input.rsvpEnabled },
        });
        return;
      }
      if (input.action === "rsvp") {
        if (!self.space.rsvpEnabled)
          throw new SocialError(409, "RSVPs are turned off for this Space.");
        if (!self.space.startsAt)
          throw new SocialError(
            400,
            "Add a date to this Space before using RSVP",
          );
        await tx.spaceMembership.update({
          where: { spaceId_userId: { spaceId: id, userId: actor } },
          data: { rsvp: input.rsvp },
        });
        return;
      }
      if (input.action === "role" || input.userId !== actor)
        requireSpaceAdmin(self);
      if (input.action === "role" && self.space.kind === "EVENT")
        throw new SocialError(
          403,
          "Event administrators are assigned by a founder.",
        );
      if (leaving) {
        const successor = await tx.spaceMembership.findFirst({
          where: { spaceId: id, userId: { not: actor } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { userId: "asc" }],
          select: { userId: true },
        });
        if (!successor && self.space.kind !== "EVENT") {
          await eraseSpace(tx, id, this.clock);
          return;
        }
        if (
          successor &&
          self.space.creatorId === actor &&
          self.space.kind !== "EVENT"
        ) {
          await tx.space.update({
            where: { id },
            data: { creatorId: successor.userId },
          });
          await tx.spaceMembership.update({
            where: {
              spaceId_userId: { spaceId: id, userId: successor.userId },
            },
            data: { role: "ADMIN" },
          });
        }
      }
      if (
        !leaving &&
        input.userId === self.space.creatorId &&
        self.space.kind !== "EVENT"
      )
        throw new SocialError(
          409,
          "The creator must remain a Space administrator",
        );
      const key = { spaceId: id, userId: input.userId };
      if (
        !(await tx.spaceMembership.findUnique({
          where: { spaceId_userId: key },
        }))
      )
        throw unavailable();
      if (input.action === "role") {
        if (await this.blocked(tx, actor, input.userId)) throw unavailable();
        await tx.spaceMembership.update({
          where: { spaceId_userId: key },
          data: { role: input.role },
        });
        if (input.role === "MEMBER")
          await tx.spaceInvitation.deleteMany({
            where: { spaceId: id, inviterId: input.userId, acceptedAt: null },
          });
      } else {
        await tx.spaceMembership.delete({ where: { spaceId_userId: key } });
        await tx.spaceInvitation.deleteMany({
          where: {
            spaceId: id,
            OR: [{ inviterId: input.userId }, { inviteeId: input.userId }],
          },
        });
      }
    });
  }
}
