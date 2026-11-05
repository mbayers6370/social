import "server-only";
import type { EventSearchPage } from "@/features/spaces/contracts";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  eventSearchInput,
  eventSearchWords,
} from "@/features/spaces/event-discovery";
import type { PrivatePhotoStore } from "@/server/social/photo";
import { ticketmasterCatalog, type EventCatalog } from "./ticketmaster";
import { eventExpiry, defaultEventEnd } from "@/features/spaces/lifecycle";
import { liveSpaceWhere } from "./access";
import { SocialService } from "@/server/social/service";
import { SocialError, unavailable } from "@/server/social/errors";

export class SpaceEventService extends SocialService {
  constructor(
    db: PrismaClient,
    store: PrivatePhotoStore,
    clock: () => Date = () => new Date(),
    private readonly catalog: EventCatalog = ticketmasterCatalog,
  ) {
    super(db, store, clock);
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
              memberships: { create: { userId: actor, role: "MEMBER" } },
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
    await tx.spaceMembership.create({
      data: { spaceId: id, userId: actor, role: "MEMBER" },
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
          "Ticketmaster search is temporarily unavailable. You can still open your joined Spaces above.",
      };
    }
  }
}
