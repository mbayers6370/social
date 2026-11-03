import "server-only";
import { notifySpacePost } from "./post-notifications";
import { memberPerson } from "@/lib/member-person";
import { memberPostDraftInput } from "@/features/social/member-schema";
import { containsPostLink } from "@/lib/platform-rules";
import { randomUUID } from "node:crypto";
import { dayKey } from "@/features/feed/format";
import { normalizePhoto } from "@/server/social/photo";
import type {
  SpaceListData,
  SpaceDetails,
  EventSearchPage,
  SpacePostPage,
  SpaceComments,
  SpaceInvitationCandidates,
} from "@/features/spaces/contracts";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  eventSearchInput,
  eventSearchWords,
} from "@/features/spaces/event-discovery";
import type { PrivatePhotoStore } from "@/server/social/photo";
import { ticketmasterCatalog, type EventCatalog } from "./ticketmaster";
import {
  eventExpiry,
  defaultEventEnd,
  validEventEnd,
} from "@/features/spaces/lifecycle";
import { liveSpaceWhere } from "./access";
import { spaceInvitationNotificationKey } from "./invitation-notifications";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import { SPACE_PHOTO_LIMIT } from "@/lib/platform-rules";
import {
  spacePostDraftInput,
  spacePostInput,
  commentInput,
} from "@/features/spaces/schema";
import {
  releaseSpacePhotoReferences,
  retireUnreferencedPhotos,
} from "./media-lifecycle";
import { SocialService } from "@/server/social/service";
import { SocialError, unavailable } from "@/server/social/errors";
import { spaceAccess, requireSpaceAdmin, unblockedAuthor } from "./access";
import {
  spaceInput,
  spaceInvitationSearch,
  memberInput,
  type SpaceInput,
  type MemberInput,
} from "@/features/spaces/schema";

export class SpaceService extends SocialService {
  constructor(
    db: PrismaClient,
    store: PrivatePhotoStore,
    clock: () => Date = () => new Date(),
    private readonly catalog: EventCatalog = ticketmasterCatalog,
  ) {
    super(db, store, clock);
  }
  async createSpace(subject: string, raw: SpaceInput) {
    const input = spaceInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      return tx.space.create({
        data: {
          name: input.name,
          kind: input.kind,
          creatorId: actor,
          ...(input.kind === "GATHERING"
            ? {
                startsAt: new Date(input.startsAt),
                timeZone: input.timeZone,
                location: input.location,
              }
            : {}),
          memberships: { create: { userId: actor, role: "ADMIN" } },
        },
        select: { id: true },
      });
    });
  }
  async joinTicketmasterEvent(subject: string, providerId: string) {
    const existing = await this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const space = await tx.space.findUnique({
        where: { ticketmasterId: providerId },
        select: { id: true },
      });
      return space ? this.joinEventInTransaction(tx, actor, space.id) : null;
    });
    if (existing) return existing;
    const event = await this.catalog.event(providerId);
    const endsAt = defaultEventEnd(event.startsAt);
    const expiresAt = eventExpiry(endsAt);
    if (expiresAt <= this.clock()) throw unavailable();
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.transaction(async (tx) => {
          const actor = await this.actor(tx, subject);
          const canonical = await tx.space.upsert({
            where: { ticketmasterId: providerId },
            update: {},
            create: {
              kind: "EVENT",
              name: event.name,
              creatorId: actor,
              startsAt: new Date(event.startsAt),
              timeZone: event.timeZone,
              location: event.location,
              ticketmasterId: providerId,
              endsAt: new Date(endsAt),
              expiresAt,
              imageUrl: event.imageUrl,
              sourceUrl: event.sourceUrl,
              memberships: { create: { userId: actor, role: "ADMIN" } },
            },
            select: { id: true },
          });
          return this.joinEventInTransaction(tx, actor, canonical.id);
        });
      } catch (error) {
        if (
          attempt === 0 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          continue;
        throw error;
      }
    }
  }
  private async joinEventInTransaction(
    tx: Prisma.TransactionClient,
    actor: string,
    id: string,
  ) {
    // Serialize joining with archive/deletion and preserve existing roles/preferences.
    await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${id} FOR UPDATE`;
    const space = await tx.space.findUnique({ where: { id } });
    if (
      !space ||
      space.deletedAt ||
      (space.expiresAt && space.expiresAt <= this.clock()) ||
      space.kind !== "EVENT"
    )
      throw unavailable();
    const current = await tx.spaceMembership.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: actor } },
    });
    if (current) return { id };
    if (space.archivedAt)
      throw new SocialError(409, "That event already exists and is archived.");
    const empty =
      (await tx.spaceMembership.count({ where: { spaceId: id } })) === 0;
    if (empty)
      await tx.space.update({ where: { id }, data: { creatorId: actor } });
    await tx.spaceMembership.create({
      data: { spaceId: id, userId: actor, role: empty ? "ADMIN" : "MEMBER" },
    });
    return { id };
  }
  async joinEvent(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      return this.joinEventInTransaction(tx, actor, id);
    });
  }
  private async searchLocalEvents(
    subject: string,
    rawQuery: string,
    before?: string,
  ): Promise<EventSearchPage> {
    const query = eventSearchInput.parse(rawQuery);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.space.findMany({
        where: {
          kind: "EVENT",
          ...liveSpaceWhere(this.clock()),
          archivedAt: null,
          ...(before ? { id: { lt: before } } : {}),
          AND: eventSearchWords(query).map((word) => ({
            OR: [
              { name: { contains: word, mode: "insensitive" as const } },
              { location: { contains: word, mode: "insensitive" as const } },
            ],
          })),
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
          memberships: { where: { userId: actor }, select: { userId: true } },
          _count: { select: { memberships: true } },
        },
      });
      return {
        events: rows.slice(0, 20).map(({ memberships, _count, ...space }) => ({
          ...space,
          startsAt: space.startsAt?.toISOString() ?? null,
          endsAt: space.endsAt?.toISOString() ?? null,
          expiresAt: space.expiresAt?.toISOString() ?? null,
          archivedAt: null,
          memberCount: _count.memberships,
          isMember: memberships.length > 0,
        })),
        nextCursor: rows.length > 20 ? rows[19].id : null,
      };
    });
  }
  async searchEvents(
    subject: string,
    query: string,
    before?: string,
  ): Promise<EventSearchPage> {
    const providerPage = before?.startsWith("tm-")
      ? Number(before.slice(3))
      : 0;
    if (
      !Number.isInteger(providerPage) ||
      providerPage < 0 ||
      providerPage >= 50
    )
      throw new SocialError(400, "Invalid event page");
    const local = await this.searchLocalEvents(
      subject,
      query,
      before?.startsWith("tm-") ? undefined : before,
    );
    try {
      const found = await this.catalog.search(query, providerPage);
      const ids = found.events.map((event) => event.id);
      const canonical = await this.transaction(async (tx) => {
        const actor = await this.actor(tx, subject);
        return tx.space.findMany({
          where: { ticketmasterId: { in: ids } },
          select: {
            id: true,
            ticketmasterId: true,
            deletedAt: true,
            expiresAt: true,
            archivedAt: true,
            endsAt: true,
            memberships: { where: { userId: actor }, select: { userId: true } },
            _count: { select: { memberships: true } },
          },
        });
      });
      const events: EventSearchPage["events"] = found.events.flatMap(
        (event) => {
          const space = canonical.find((s) => s.ticketmasterId === event.id);
          if (
            space &&
            (space.deletedAt ||
              space.archivedAt ||
              (space.expiresAt && space.expiresAt <= this.clock()))
          )
            return [];
          return [
            {
              ...event,
              endsAt:
                space?.endsAt?.toISOString() ??
                defaultEventEnd(event.startsAt).toISOString(),
              id: space?.id ?? event.id,
              ticketmasterId: event.id,
              kind: "EVENT" as const,
              archivedAt: null,
              expiresAt:
                space?.expiresAt?.toISOString() ??
                eventExpiry(defaultEventEnd(event.startsAt)).toISOString(),
              memberCount: space?._count.memberships ?? 0,
              isMember: Boolean(space?.memberships.length),
            },
          ];
        },
      );
      return {
        events: [
          ...new Map(
            [...local.events, ...events].map((event) => [
              event.ticketmasterId ?? event.id,
              event,
            ]),
          ).values(),
        ],
        nextCursor:
          local.nextCursor ??
          (found.nextPage === null ? null : `tm-${found.nextPage}`),
      };
    } catch (error) {
      if (error instanceof SocialError && error.status === 403) throw error;
      return {
        ...local,
        notice:
          "Ticketmaster search is temporarily unavailable. You can still open your joined Spaces below.",
      };
    }
  }
  async listSpaces(subject: string, before?: string): Promise<SpaceListData> {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.space.findMany({
        where: {
          ...liveSpaceWhere(this.clock()),
          memberships: { some: { userId: actor } },
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
          space: { ...liveSpaceWhere(this.clock()), archivedAt: null },
          inviter: unblockedAuthor(actor),
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
        rsvp: membership.rsvp,
        members: members.map(({ user, ...m }) => ({
          ...m,
          name: user.account!.displayName,
        })),
        memberCount: await tx.spaceMembership.count({ where: { spaceId: id } }),
      };
    });
  }
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
      const friend: Prisma.UserWhereInput = {
        OR: [
          { friendshipsLow: { some: { highId: actor, status: "ACCEPTED" } } },
          { friendshipsHigh: { some: { lowId: actor, status: "ACCEPTED" } } },
        ],
      };
      const eligible: Prisma.UserWhereInput = {
        ...unblockedAuthor(actor),
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
          select: { displayName: true, username: true, portraitPhotoId: true },
        },
      } as const;
      const orderBy: Prisma.UserOrderByWithRelationInput[] = [
        { account: { displayName: "asc" } },
        { id: "asc" },
      ];
      // Rank before limiting: a friend's name must not fall behind the first page of strangers.
      const friends = await tx.user.findMany({
        where: { AND: [eligible, friend] },
        select,
        orderBy,
        take: 21,
      });
      const others =
        term && friends.length < 21
          ? await tx.user.findMany({
              where: { AND: [eligible, { NOT: friend }] },
              select,
              orderBy,
              take: 21 - friends.length,
            })
          : [];
      const rows = [
        ...friends.map((row) => ({ row, friend: true })),
        ...others.map((row) => ({ row, friend: false })),
      ];
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
          where: { id: invitation.inviterId, ...unblockedAuthor(actor) },
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
      if (input.kind !== member.space.kind)
        throw new SocialError(400, "The Space type cannot be changed");
      await tx.space.update({
        where: { id },
        data: {
          name: input.name,
          ...(input.kind === "GATHERING"
            ? {
                startsAt: new Date(input.startsAt),
                timeZone: input.timeZone,
                location: input.location ?? "",
              }
            : {}),
        },
      });
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
        throw new SocialError(409, "This event is archived and read-only");
      if (input.action === "rsvp") {
        if (self.space.kind === "PRIVATE")
          throw new SocialError(400, "RSVP is only available for events");
        await tx.spaceMembership.update({
          where: { spaceId_userId: { spaceId: id, userId: actor } },
          data: { rsvp: input.rsvp },
        });
        return;
      }
      if (input.action === "role" || input.userId !== actor)
        requireSpaceAdmin(self);
      if (leaving) {
        const successor = await tx.spaceMembership.findFirst({
          where: { spaceId: id, userId: { not: actor } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { userId: "asc" }],
          select: { userId: true },
        });
        if (!successor && self.space.kind !== "EVENT") {
          await this.eraseSpace(tx, id);
          return;
        }
        if (successor && self.space.creatorId === actor) {
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
      if (!leaving && input.userId === self.space.creatorId)
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
  async archive(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const member = await spaceAccess(tx, actor, id, false, this.clock());
      requireSpaceAdmin(member);
      if (member.space.kind !== "GATHERING")
        throw new SocialError(
          400,
          "Only Gathering Spaces can be archived. Event Spaces close automatically.",
        );
      await tx.space.update({
        where: { id },
        data: { archivedAt: this.clock() },
      });
    });
  }
  async publish(subject: string, id: string, raw: unknown) {
    const input = spacePostInput.parse(raw);
    if (new Set(input.photoIds).size !== input.photoIds.length)
      throw new SocialError(400, "Choose each photograph once");
    return this.transaction((tx) =>
      this.publishInTransaction(tx, subject, id, input),
    );
  }
  protected async publishInTransaction(
    tx: Prisma.TransactionClient,
    subject: string,
    id: string | undefined,
    input: { body: string; photoIds: string[] },
  ) {
    const actor = await this.actor(tx, subject);
    await this.lock(tx, [actor]);
    const membership = id
      ? await spaceAccess(tx, actor, id, true, this.clock())
      : null;
    if (id) await releaseSpacePhotoReferences(tx, id, this.clock());
    else
      await this.quota(
        tx,
        actor,
        containsPostLink({ body: input.body }),
        this.clock(),
      );
    for (const photoId of input.photoIds) {
      const photo = await this.photoAudience(tx, actor, photoId);
      if (photo.ownerId !== actor) throw unavailable();
      if (!id) continue;
      const present = await tx.spacePhoto.findUnique({
        where: { spaceId_photoId: { spaceId: id, photoId } },
      });
      if (!present) {
        const count = await tx.spacePhoto.count({
          where: {
            spaceId: id,
            photo: {
              OR: [
                { state: "READY" },
                { state: "PENDING", uploadExpiresAt: { gt: this.clock() } },
              ],
            },
          },
        });
        if (count >= SPACE_PHOTO_LIMIT)
          throw new SocialError(
            409,
            `This Space already retains ${SPACE_PHOTO_LIMIT} photographs`,
          );
        await tx.spacePhoto.create({ data: { spaceId: id, photoId } });
      }
    }
    const post = await tx.post.create({
      data: {
        ...this.postData(actor, input.body, this.clock()),
        ...(id ? { spaceId: id } : {}),
        ...(membership?.space.expiresAt
          ? {
              expiresAt: new Date(
                Math.min(
                  membership.space.expiresAt.getTime(),
                  this.clock().getTime() + 30 * 86400_000,
                ),
              ),
            }
          : {}),
        photos: { create: input.photoIds.map((photoId) => ({ photoId })) },
      },
      select: { id: true },
    });
    await notifySpacePost(
      tx,
      actor,
      membership?.space ?? null,
      post.id,
      this.clock(),
    );
    return post;
  }
  /** Reserve every upload, then publish text and all attachments atomically. */
  async publishWithUploads(
    subject: string,
    id: string | undefined,
    raw: unknown,
    files: { bytes: Uint8Array; type: string; description: string }[],
  ) {
    const input = (id ? spacePostDraftInput : memberPostDraftInput).parse(raw);
    if (
      !files.length ||
      files.length + input.photoIds.length > 3 ||
      new Set(input.photoIds).size !== input.photoIds.length
    )
      throw new SocialError(400, "Choose up to three photographs.");
    for (const file of files) {
      if (
        !file.bytes.length ||
        file.bytes.length > PHOTO_MAX_BYTES ||
        !file.description.trim() ||
        file.description.length > 500
      )
        throw new SocialError(400, "Invalid photograph.");
    }
    const reservations = await this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId]);
      const now = this.clock();
      if (id) {
        await spaceAccess(tx, ownerId, id, true, now);
        await releaseSpacePhotoReferences(tx, id, now);
      } else
        await this.quota(
          tx,
          ownerId,
          containsPostLink({ body: input.body }),
          now,
        );
      // Recheck owned saved attachments before reserving bytes or daily allowance.
      for (const photoId of input.photoIds) {
        const photo = await this.photoAudience(tx, ownerId, photoId);
        if (photo.ownerId !== ownerId) throw unavailable();
      }
      const reservations = [];
      for (const file of files) {
        await this.photoQuota(tx, ownerId, now);
        const slots = id
          ? await tx.spacePhoto.count({
              where: {
                spaceId: id,
                photo: {
                  OR: [
                    { state: "READY" },
                    { state: "PENDING", uploadExpiresAt: { gt: now } },
                  ],
                },
              },
            })
          : (await tx.galleryEntry.count({ where: { ownerId } })) +
            (await tx.photo.count({
              where: {
                ownerId,
                state: "PENDING",
                uploadExpiresAt: { gt: now },
                spaceReferences: { none: {} },
              },
            }));
        if (slots >= SPACE_PHOTO_LIMIT)
          throw new SocialError(
            409,
            id
              ? `This Space already retains ${SPACE_PHOTO_LIMIT} photographs`
              : "Your gallery is full. Reuse a saved photograph or replace a gallery photograph first.",
          );
        reservations.push(
          await tx.photo.create({
            data: {
              ownerId,
              objectKey: `social/${randomUUID()}.webp`,
              dayKey: dayKey(now.toISOString()),
              createdAt: now,
              uploadExpiresAt: new Date(now.getTime() + 600_000),
              description: file.description.trim(),
              width: 1,
              height: 1,
              byteLength: 1,
              ...(id ? { spaceReferences: { create: { spaceId: id } } } : {}),
            },
          }),
        );
      }
      return reservations;
    });
    try {
      const normalized: Awaited<ReturnType<typeof normalizePhoto>>[] = [];
      for (let index = 0; index < files.length; index++) {
        const photo = await normalizePhoto(
          files[index].bytes,
          files[index].type,
        );
        await this.store.put(reservations[index].objectKey, photo.bytes);
        normalized.push(photo);
      }
      return await this.transaction(async (tx) => {
        const ownerId = await this.actor(tx, subject);
        await this.lock(tx, [ownerId]);
        const now = this.clock();
        if (id) await spaceAccess(tx, ownerId, id, true, now);
        else if (
          (await tx.galleryEntry.count({ where: { ownerId } })) +
            reservations.length >
          20
        )
          throw new SocialError(
            409,
            "Your gallery changed. Make room before publishing.",
          );
        const post = await this.publishInTransaction(tx, subject, id, input);
        for (let index = 0; index < reservations.length; index++) {
          const pending = await tx.photo.findUniqueOrThrow({
            where: { id: reservations[index].id },
          });
          if (
            pending.ownerId !== ownerId ||
            pending.state !== "PENDING" ||
            pending.uploadExpiresAt <= now ||
            pending.dayKey !== dayKey(now.toISOString())
          )
            throw new SocialError(409, "Upload expired; try again");
          await this.photoQuota(tx, ownerId, now, pending.id);
          const photo = normalized[index];
          await tx.photo.update({
            where: { id: pending.id },
            data: {
              state: "READY",
              uploadedAt: now,
              width: photo.width,
              height: photo.height,
              byteLength: photo.byteLength,
            },
          });
        }
        if (!id) {
          const last = await tx.galleryEntry.aggregate({
            where: { ownerId },
            _max: { position: true },
          });
          await tx.galleryEntry.createMany({
            data: reservations.map((photo, index) => ({
              photoId: photo.id,
              ownerId,
              position: (last._max.position ?? -1) + index + 1,
            })),
          });
          await tx.account.update({
            where: { userId: ownerId },
            data: { galleryVersion: { increment: 1 } },
          });
        }
        await tx.postPhoto.createMany({
          data: reservations.map((photo) => ({
            postId: post.id,
            photoId: photo.id,
            ownerId,
          })),
        });
        return post;
      });
    } catch (error) {
      await this.db.photo.updateMany({
        where: {
          id: { in: reservations.map((photo) => photo.id) },
          state: { not: "READY" },
        },
        data: { state: "DELETE_PENDING" },
      });
      throw error;
    }
  }
  async reusablePhotos(subject: string, spaceId: string, before?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor]);
      await spaceAccess(tx, actor, spaceId, true, this.clock());
      // Only owned, already authorized canonical assets; no cross-owner attachment workaround.
      const photos = await tx.photo.findMany({
        where: {
          ownerId: actor,
          state: "READY",
          ...(before ? { id: { lt: before } } : {}),
          OR: [
            { gallery: { isNot: null } },
            {
              posts: {
                some: {
                  post: {
                    deletedAt: null,
                    expiresAt: { gt: this.clock() },
                    OR: [
                      { spaceId: null },
                      {
                        space: {
                          ...liveSpaceWhere(this.clock()),
                          memberships: { some: { userId: actor } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
        orderBy: { id: "desc" },
        take: 21,
        select: { id: true, description: true, width: true, height: true },
      });
      return {
        photos: photos.slice(0, 20),
        nextCursor: photos.length > 20 ? photos[19].id : null,
      };
    });
  }
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
  async feed(subject: string, before?: string) {
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
              space: {
                deletedAt: null,
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
  async deleteSpace(subject: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const membership = await spaceAccess(tx, actor, id, false, this.clock());
      if (membership.space.creatorId !== actor)
        throw new SocialError(403, "Only the creator can delete this Space");
      await this.eraseSpace(tx, id);
    });
  }
  private async eraseSpace(tx: Prisma.TransactionClient, id: string) {
    const photoIds = (
      await tx.spacePhoto.findMany({
        where: { spaceId: id },
        select: { photoId: true },
      })
    ).map((r) => r.photoId);
    await tx.postComment.deleteMany({ where: { post: { spaceId: id } } });
    await tx.postPhoto.deleteMany({ where: { post: { spaceId: id } } });
    await tx.post.updateMany({
      where: { spaceId: id },
      data: { body: "", deletedAt: this.clock() },
    });
    await tx.spacePhoto.deleteMany({ where: { spaceId: id } });
    await tx.spaceInvitation.deleteMany({ where: { spaceId: id } });
    await tx.spaceMembership.deleteMany({ where: { spaceId: id } });
    await tx.space.update({
      where: { id },
      data: {
        deletedAt: this.clock(),
        name: "Deleted Space",
        startsAt: null,
        timeZone: null,
        location: null,
        endsAt: null,
        expiresAt: null,
        imageUrl: null,
        sourceUrl: null,
      },
    });
    await retireUnreferencedPhotos(tx, photoIds, this.clock());
  }
  /** Trusted maintenance entry point; access is denied at the deadline even before this runs. */
  async expireSpaces(limit = 20) {
    const rows = await this.db.space.findMany({
      where: {
        kind: "EVENT",
        deletedAt: null,
        expiresAt: { lte: this.clock() },
      },
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true },
    });
    let expired = 0;
    for (const row of rows) {
      const removed = await this.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${row.id} FOR UPDATE`;
        const current = await tx.space.findFirst({
          where: {
            id: row.id,
            deletedAt: null,
            expiresAt: { lte: this.clock() },
          },
          select: { id: true },
        });
        if (!current) return false;
        await this.eraseSpace(tx, row.id);
        return true;
      });
      if (removed) expired++;
    }
    return expired;
  }
}
