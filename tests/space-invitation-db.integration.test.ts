// @vitest-environment node
import { privateTestDatabaseUrl } from "./helpers/database";
// Real disposable PostgreSQL; session/rate-limit adapters are controlled doubles.
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { PrismaClient } from "@/generated/prisma/client";
import { MemberService } from "@/server/member/service";
import { spaceInvitationNotificationKey } from "@/server/spaces/invitation-notifications";
import { socialRequest } from "@/server/social/http";
import { memberRequest } from "@/server/member/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
const session = vi.hoisted(() => ({ subject: "" }));
vi.mock("@/server/auth", () => ({
  requireViewer: async () => ({ id: session.subject }),
  UnauthorizedError: class extends Error {},
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(),
}));
import { getDb } from "@/server/db";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "Space invitation lookup with real PostgreSQL",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let people: { id: string; clerkId: string }[];
    let room: { id: string };
    const now = new Date("2026-11-03T12:00:00Z");
    beforeAll(() => {
      const url = privateTestDatabaseUrl();
      db = new PrismaClient({
        adapter: createDatabaseAdapter(url.href, 3),
      });
      service = new MemberService(
        db,
        { put: vi.fn(), get: vi.fn(), delete: vi.fn() },
        () => now,
      );
    });
    async function person(
      name: string,
      status: "ACTIVE" | "PENDING" = "ACTIVE",
    ) {
      const result = await db.user.create({
        data: {
          clerkId: `space-lookup-${randomUUID()}`,
          account: {
            create: {
              status,
              displayName: name,
              username: `u_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
            },
          },
        },
        select: { id: true, clerkId: true },
      });
      people.push(result);
      return result;
    }
    beforeEach(async () => {
      people = [];
      await person("Owner");
      await person("Zoe Match");
      await person("Adam Match");
      await person("Member Match");
      await person("Blocked Match");
      await person("Pending Match", "PENDING");
      await person("Invited Match");
      room = await service.createSpace(people[0].clerkId, {
        kind: "PRIVATE",
        name: "Lookup",
      });
      await service.relationship(people[0].clerkId, people[1].id, "request");
      await service.relationship(people[1].clerkId, people[0].id, "accept");
      for (const index of [3, 6]) {
        await service.relationship(
          people[0].clerkId,
          people[index].id,
          "request",
        );
        await service.relationship(
          people[index].clerkId,
          people[0].id,
          "accept",
        );
      }
      const invitation = await service.invite(
        people[0].clerkId,
        room.id,
        people[3].id,
      );
      await service.accept(people[3].clerkId, invitation.id);
      await service.relationship(people[4].clerkId, people[0].id, "block");
      await service.invite(people[0].clerkId, room.id, people[6].id);
      session.subject = people[0].clerkId;
      vi.mocked(getDb).mockReturnValue(db);
      vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    });
    afterEach(async () => {
      await db.space.deleteMany({ where: { id: room.id } });
      await db.user.deleteMany({
        where: { id: { in: people.map((person) => person.id) } },
      });
      vi.unstubAllEnvs();
      vi.clearAllMocks();
    });
    afterAll(async () => db.$disconnect());
    it("shows only accepted friends, including for a matching search, and excludes ineligible people", async () => {
      const before = await db.spaceInvitation.count();
      const initial = await service.invitationCandidates(
        people[0].clerkId,
        room.id,
      );
      expect(initial.members.map((member) => member.person.id)).toEqual([
        people[1].id,
      ]);
      const results = await service.invitationCandidates(
        people[0].clerkId,
        room.id,
        "MATCH",
      );
      expect(
        results.members.map((member) => [member.person.id, member.friend]),
      ).toEqual([[people[1].id, true]]);
      expect(results.hasMore).toBe(false);
      expect(await db.spaceInvitation.count()).toBe(before);
      const friend = await db.account.findUniqueOrThrow({
        where: { userId: people[1].id },
      });
      expect(
        (
          await service.invitationCandidates(
            people[0].clerkId,
            room.id,
            `@${friend.username}`,
          )
        ).members[0].person.id,
      ).toBe(people[1].id);
    });
    it("delivers one recipient-scoped notification per invitation, preserves read state, and joins through the existing acceptance checks", async () => {
      await service.relationship(people[0].clerkId, people[2].id, "request");
      await service.relationship(people[2].clerkId, people[0].id, "accept");
      const invitation = await service.invite(
        people[0].clerkId,
        room.id,
        people[2].id,
      );
      expect(
        await service.invite(people[0].clerkId, room.id, people[2].id),
      ).toEqual(invitation);
      expect(
        await db.memberNotification.count({
          where: { dedupeKey: spaceInvitationNotificationKey(invitation.id) },
        }),
      ).toBe(1);
      const activity = (await service.notifications(people[2].clerkId))
        .activity;
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        kind: "space_invitation",
        read: false,
        actor: { id: people[0].id },
        invitation: { id: invitation.id, space: { name: "Lookup" } },
        href: "/app/spaces#space-invitations",
      });
      expect(
        (await service.notifications(people[1].clerkId)).activity.some(
          (row) => row.id === activity[0].id,
        ),
      ).toBe(false);
      await service.readNotifications(people[1].clerkId, activity[0].id);
      expect(
        (await service.notifications(people[2].clerkId)).activity[0].read,
      ).toBe(false);
      await service.readNotifications(people[2].clerkId, activity[0].id);
      expect(
        (await service.notifications(people[2].clerkId)).activity[0].read,
      ).toBe(true);
      await expect(
        service.accept(people[1].clerkId, invitation.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(await service.accept(people[2].clerkId, invitation.id)).toEqual({
        id: room.id,
      });
      expect((await service.notifications(people[2].clerkId)).activity).toEqual(
        [],
      );
      expect((await service.listSpaces(people[2].clerkId)).spaces[0].id).toBe(
        room.id,
      );
      expect((await service.readSpace(people[2].clerkId, room.id)).name).toBe(
        "Lookup",
      );
    });
    it("reconciles a pre-existing invitation without duplicating activity or resetting read state", async () => {
      const invitation = await db.spaceInvitation.findFirstOrThrow({
        where: { inviteeId: people[6].id, acceptedAt: null },
      });
      await db.memberNotification.deleteMany({
        where: { dedupeKey: spaceInvitationNotificationKey(invitation.id) },
      });
      const first = (await service.notifications(people[6].clerkId)).activity;
      expect(first).toHaveLength(1);
      expect(first[0].invitation?.id).toBe(invitation.id);
      await service.readNotifications(people[6].clerkId, first[0].id);
      expect((await service.notifications(people[6].clerkId)).activity).toEqual(
        [{ ...first[0], read: true }],
      );
    });
    it.each([
      "expired",
      "archived",
      "demoted",
      "removed",
      "blocked",
      "inactive",
      "deleted",
      "joined",
    ])(
      "hides a %s invitation and never grants Space content through activity",
      async (state) => {
        const invitation = await db.spaceInvitation.findFirstOrThrow({
          where: { inviteeId: people[6].id, acceptedAt: null },
        });
        expect(
          (await service.notifications(people[6].clerkId)).activity,
        ).toHaveLength(1);
        if (state === "expired")
          await db.spaceInvitation.update({
            where: { id: invitation.id },
            data: { expiresAt: now },
          });
        if (state === "archived")
          await db.space.update({
            where: { id: room.id },
            data: { archivedAt: now },
          });
        if (state === "demoted")
          await db.spaceMembership.update({
            where: {
              spaceId_userId: { spaceId: room.id, userId: people[0].id },
            },
            data: { role: "MEMBER" },
          });
        if (state === "removed")
          await db.spaceMembership.delete({
            where: {
              spaceId_userId: { spaceId: room.id, userId: people[0].id },
            },
          });
        if (state === "blocked")
          await service.relationship(people[6].clerkId, people[0].id, "block");
        if (state === "inactive")
          await db.account.update({
            where: { userId: people[0].id },
            data: { status: "DEACTIVATED" },
          });
        if (state === "deleted")
          await db.space.update({
            where: { id: room.id },
            data: { deletedAt: now },
          });
        if (state === "joined")
          await db.spaceMembership.create({
            data: { spaceId: room.id, userId: people[6].id },
          });
        expect(
          (await service.notifications(people[6].clerkId)).activity,
        ).toEqual([]);
        if (state !== "joined") {
          await expect(
            service.readSpace(people[6].clerkId, room.id),
          ).rejects.toMatchObject({ status: 404 });
          await expect(
            service.accept(people[6].clerkId, invitation.id),
          ).rejects.toMatchObject({
            status:
              state === "archived" ? 409 : state === "demoted" ? 403 : 404,
          });
          expect(
            await db.spaceMembership.findUnique({
              where: {
                spaceId_userId: { spaceId: room.id, userId: people[6].id },
              },
            }),
          ).toBeNull();
        }
      },
    );
    it("ranks before applying the result cap and tells the caller to refine a broad search", async () => {
      // Keep bytewise and locale-aware collations in agreement. "ZZ" and
      // "Zoe" sort differently in macOS's local DB and Linux CI.
      for (const name of [
        ...Array.from({ length: 24 }, (_, i) => `Zzz Match ${i}`),
        "Aaron Match",
      ]) {
        const member = await person(name);
        await service.relationship(people[0].clerkId, member.id, "request");
        await service.relationship(member.clerkId, people[0].id, "accept");
      }
      const result = await service.invitationCandidates(
        people[0].clerkId,
        room.id,
        "match",
      );
      expect(result.members).toHaveLength(20);
      expect(result.members.every((member) => member.friend)).toBe(true);
      // This friend was inserted last, beyond the cap, but must rank first.
      expect(result.members[0].person.name).toBe("Aaron Match");
      expect(result.members.map((member) => member.person.name)).toEqual(
        [...result.members.map((member) => member.person.name)].sort(),
      );
      expect(result.hasMore).toBe(true);
      expect(
        result.members.map((member) => Object.keys(member).sort()),
      ).toEqual(Array(20).fill(["friend", "person", "username"]));
    });
    it("requires current administrator access and refuses archived, missing and inactive access", async () => {
      await expect(
        service.invitationCandidates(people[3].clerkId, room.id, "match"),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.invitationCandidates(people[2].clerkId, room.id, "match"),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.invitationCandidates(people[5].clerkId, room.id, "match"),
      ).rejects.toMatchObject({ status: 403 });
      await db.space.update({
        where: { id: room.id },
        data: { archivedAt: now },
      });
      await expect(
        service.invitationCandidates(people[0].clerkId, room.id, "match"),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("rechecks eligibility when the sender chooses a result after a new block", async () => {
      await service.relationship(people[0].clerkId, people[2].id, "request");
      await service.relationship(people[2].clerkId, people[0].id, "accept");
      expect(
        (await service.invitationCandidates(people[0].clerkId, room.id, "Adam"))
          .members,
      ).toHaveLength(1);
      await service.relationship(people[0].clerkId, people[2].id, "block");
      expect(
        (await service.invitationCandidates(people[0].clerkId, room.id, "Adam"))
          .members,
      ).toHaveLength(0);
      await expect(
        service.invite(people[0].clerkId, room.id, people[2].id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("uses the private, rate-limited read boundary and rejects malformed or extra query parameters", async () => {
      const get = (query: string) =>
        socialRequest(
          new Request(
            `http://localhost:3000/api/spaces/${room.id}/invitations${query}`,
          ),
          "spaceInviteCandidates",
          room.id,
        );
      const response = await get("?q=match");
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(enforceRateLimit).toHaveBeenCalledWith("read", people[0].clerkId);
      expect((await get("?q=x")).status).toBe(400);
      expect((await get("?q=match&q=other")).status).toBe(400);
      expect((await get("?role=ADMIN")).status).toBe(400);
    });
    it("delivers invitations through authenticated activity and accepts them through the existing protected HTTP action", async () => {
      const invitation = await db.spaceInvitation.findFirstOrThrow({
        where: { inviteeId: people[6].id, acceptedAt: null },
      });
      session.subject = people[6].clerkId;
      const activity = await memberRequest(
        new Request("http://localhost:3000/api/notifications"),
        "notifications",
      );
      expect(activity.status).toBe(200);
      expect(activity.headers.get("cache-control")).toContain("no-store");
      expect((await activity.json()).activity).toEqual([
        expect.objectContaining({
          kind: "space_invitation",
          invitation: { id: invitation.id, space: { name: "Lookup" } },
        }),
      ]);
      const accept = () =>
        socialRequest(
          new Request(
            `http://localhost:3000/api/space-invitations/${invitation.id}/accept`,
            { method: "POST", headers: { Origin: "http://localhost:3000" } },
          ),
          "spaceAccept",
          invitation.id,
        );
      expect((await accept()).status).toBe(200);
      expect((await service.listSpaces(people[6].clerkId)).spaces[0].id).toBe(
        room.id,
      );
      expect((await service.notifications(people[6].clerkId)).activity).toEqual(
        [],
      );
    });
  },
);
