import "server-only";
import type { SpaceListData, SpaceDetails } from "@/features/spaces/contracts";
import {
  eventExpiry,
  validEventEnd,
  privateSpaceStorageKind,
} from "@/features/spaces/lifecycle";
import { liveSpaceWhere } from "./access";
import { SocialService } from "@/server/social/service";
import { SocialError } from "@/server/social/errors";
import {
  spaceAccess,
  requireSpaceAdmin,
  unblockedAuthor,
  acceptedFriendOf,
} from "./access";
import { spaceInput, type SpaceInput } from "@/features/spaces/schema";

export class SpaceDirectoryService extends SocialService {
  async createSpace(subject: string, raw: SpaceInput) {
    const input = spaceInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      return tx.space.create({
        data: {
          name: input.name,
          kind: privateSpaceStorageKind(input.startsAt),
          creatorId: actor,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          timeZone: input.timeZone ?? null,
          location: input.location || null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          rsvpEnabled: input.rsvpEnabled ?? true,
          memberships: { create: { userId: actor, role: "ADMIN" } },
        },
        select: { id: true },
      });
    });
  }

  async listSpaces(
    subject: string,
    before?: string,
    includeEvents = true,
  ): Promise<SpaceListData> {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.space.findMany({
        where: {
          ...liveSpaceWhere(this.clock()),
          memberships: { some: { userId: actor } },
          ...(!includeEvents ? { kind: { not: "EVENT" as const } } : {}),
          ...(before ? { id: { lt: before } } : {}),
        },
        orderBy: { id: "desc" },
        take: 21,
        select: {
          id: true,
          name: true,
          kind: true,
          startsAt: true,
          timeZone: true,
          location: true,
          archivedAt: true,
          endsAt: true,
          expiresAt: true,
          imageUrl: true,
          sourceUrl: true,
          ticketmasterId: true,
          _count: { select: { memberships: true } },
        },
      });
      const invitations = await tx.spaceInvitation.findMany({
        where: {
          inviteeId: actor,
          acceptedAt: null,
          expiresAt: { gt: this.clock() },
          space: {
            ...liveSpaceWhere(this.clock()),
            archivedAt: null,
            ...(!includeEvents ? { kind: { not: "EVENT" as const } } : {}),
          },
          inviter: { ...unblockedAuthor(actor), ...acceptedFriendOf(actor) },
        },
        orderBy: { id: "desc" },
        take: 20,
        select: { id: true, space: { select: { name: true } } },
      });
      return {
        spaces: rows.slice(0, 20).map(({ _count, ...s }) => ({
          ...s,
          startsAt: s.startsAt?.toISOString() ?? null,
          endsAt: s.endsAt?.toISOString() ?? null,
          expiresAt: s.expiresAt?.toISOString() ?? null,
          archivedAt: s.archivedAt?.toISOString() ?? null,
          memberCount: _count.memberships,
        })),
        nextCursor: rows.length > 20 ? rows[19].id : null,
        invitations,
      };
    });
  }

  async readSpace(subject: string, id: string): Promise<SpaceDetails> {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const membership = await spaceAccess(tx, actor, id, false, this.clock());
      const members = await tx.spaceMembership.findMany({
        where: { spaceId: id, user: unblockedAuthor(actor) },
        orderBy: { userId: "asc" },
        take: 100,
        select: {
          userId: true,
          role: true,
          rsvp: true,
          user: { select: { account: { select: { displayName: true } } } },
        },
      });
      const blockedMembers = await tx.block.findMany({
        where: {
          blockerId: actor,
          blocked: { memberships: { some: { spaceId: id } } },
        },
        select: {
          blocked: {
            select: {
              id: true,
              account: { select: { displayName: true, portraitPhotoId: true } },
            },
          },
        },
        take: 100,
      });
      const {
        id: spaceId,
        name,
        kind,
        creatorId,
        startsAt,
        timeZone,
        location,
        archivedAt,
        endsAt,
        expiresAt,
        imageUrl,
        sourceUrl,
        ticketmasterId,
        rsvpEnabled,
      } = membership.space;
      return {
        id: spaceId,
        name,
        kind,
        creatorId,
        timeZone,
        location,
        startsAt: startsAt?.toISOString() ?? null,
        archivedAt: archivedAt?.toISOString() ?? null,
        endsAt: endsAt?.toISOString() ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        imageUrl,
        sourceUrl,
        ticketmasterId,
        blockedMembers: blockedMembers.map(({ blocked }) => ({
          id: blocked.id,
          name: blocked.account?.displayName ?? "Margin member",
        })),
        viewerId: actor,
        role: membership.role,
        includeInFeed: membership.includeInFeed,
        rsvpEnabled,
        rsvp: startsAt && rsvpEnabled ? membership.rsvp : null,
        members: members.map(({ user, ...m }) => ({
          ...m,
          rsvp: startsAt && rsvpEnabled ? m.rsvp : null,
          name: user.account!.displayName,
        })),
        memberCount: await tx.spaceMembership.count({ where: { spaceId: id } }),
      };
    });
  }

  async updateEventSchedule(subject: string, id: string, endsAt: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const member = await spaceAccess(tx, actor, id, true, this.clock());
      requireSpaceAdmin(member);
      if (member.space.kind !== "EVENT" || !member.space.startsAt)
        throw new SocialError(
          400,
          "Only public Event Spaces have this schedule.",
        );
      if (!validEventEnd(member.space.startsAt, endsAt))
        throw new SocialError(
          400,
          "Choose an end time after the start and within 30 days.",
        );
      const expiresAt = eventExpiry(endsAt);
      if (expiresAt <= this.clock())
        throw new SocialError(
          400,
          "Choose an end time whose Space has not already expired.",
        );
      await tx.space.update({
        where: { id },
        data: { endsAt: new Date(endsAt), expiresAt },
      });
      // Keep existing text and photo posts aligned with the adjusted deadline,
      // preserving their independent maximum 30-day lifetime.
      await tx.$executeRaw`UPDATE "Post" SET "expiresAt" = LEAST("createdAt" + INTERVAL '30 days', ${expiresAt}) WHERE "spaceId" = ${id} AND "deletedAt" IS NULL`;
    });
  }

  async updateSpace(subject: string, id: string, raw: SpaceInput) {
    const input = spaceInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const member = await spaceAccess(tx, actor, id, true, this.clock());
      requireSpaceAdmin(member);
      if (member.space.kind === "EVENT")
        throw new SocialError(
          409,
          "Event details come from Ticketmaster and cannot be changed here.",
        );
      await tx.space.update({
        where: { id },
        data: {
          name: input.name,
          kind: privateSpaceStorageKind(input.startsAt),
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          timeZone: input.timeZone ?? null,
          location: input.location || null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          rsvpEnabled: input.rsvpEnabled ?? member.space.rsvpEnabled,
        },
      });
      if (!input.startsAt)
        await tx.spaceMembership.updateMany({
          where: { spaceId: id },
          data: { rsvp: null },
        });
    });
  }

  async archive(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const member = await spaceAccess(tx, actor, id, false, this.clock());
      requireSpaceAdmin(member);
      if (member.space.kind === "EVENT")
        throw new SocialError(400, "Event Spaces close automatically.");
      await tx.space.update({
        where: { id },
        data: { archivedAt: this.clock() },
      });
    });
  }
}
