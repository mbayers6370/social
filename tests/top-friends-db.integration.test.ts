// @vitest-environment node
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { MemberService } from "@/server/member/service";
import { ModerationService } from "@/server/safety/service";
import { privateTestDatabaseUrl } from "./helpers/database";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "Top 4 database boundaries",
  () => {
    let db: PrismaClient;
    let service: MemberService;
    let actors: { id: string; clerkId: string }[];
    beforeAll(() => {
      db = new PrismaClient({
        adapter: createDatabaseAdapter(privateTestDatabaseUrl().href, 8),
      });
    });
    beforeEach(async () => {
      actors = [];
      for (let i = 0; i < 7; i++)
        actors.push(
          await db.user.create({
            data: {
              clerkId: `top-${randomUUID()}`,
              account: {
                create: {
                  status: "ACTIVE",
                  displayName: `Friend ${i}`,
                  role: i === 6 ? "FOUNDER" : "MEMBER",
                },
              },
            },
          }),
        );
      service = new MemberService(db, {
        put: async () => {},
        get: async () => new Uint8Array(),
        delete: async () => {},
      });
      // Use real relationship operations and clear their notifications before observing Top 4 changes.
      for (let i = 1; i <= 4; i++) {
        await service.relationship(actors[0].clerkId, actors[i].id, "request");
        await service.relationship(actors[i].clerkId, actors[0].id, "accept");
      }
      await db.memberNotification.deleteMany({
        where: { recipientId: { in: actors.map((a) => a.id) } },
      });
    });
    afterEach(async () => {
      await db.operatorAction.deleteMany({
        where: { operatorId: { in: actors.map((a) => a.id) } },
      });
      await db.safetyReport.deleteMany({
        where: { reporterId: { in: actors.map((a) => a.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: actors.map((a) => a.id) } },
      });
    });
    afterAll(async () => db.$disconnect());
    function concurrentSnapshots(participants: number) {
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      return new (class extends MemberService {
        protected override async actor(
          tx: Prisma.TransactionClient,
          subject: string,
        ) {
          const id = await super.actor(tx, subject);
          const arrival = ++arrivals;
          if (arrival === participants) release();
          if (arrival <= participants) await barrier;
          return id;
        }
      })(db, {
        put: async () => {},
        get: async () => new Uint8Array(),
        delete: async () => {},
      });
    }
    const ids = (indices: number[]) => indices.map((i) => actors[i].id);
    const save = (indices: number[], requestId = randomUUID(), actor = 0) =>
      service.updateTopFriends(actors[actor].clerkId, {
        friendIds: ids(indices),
        requestId,
      });
    const stored = () =>
      db.profileTopFriend.findMany({
        where: { ownerId: actors[0].id },
        orderBy: { position: "asc" },
      });
    const expectOrder = async (indices: number[]) =>
      expect((await stored()).map((r) => [r.friendId, r.position])).toEqual(
        ids(indices).map((id, position) => [id, position]),
      );

    it.each([0, 1, 2, 3, 4])(
      "accepts %i selections, preserves order, and makes no notifications",
      async (count) => {
        const chosen = [4, 2, 1, 3].slice(0, count);
        expect((await save(chosen)).selected.map((p) => p.id)).toEqual(
          ids(chosen),
        );
        await expectOrder(chosen);
        expect(
          await db.memberNotification.count({
            where: { recipientId: { in: actors.map((a) => a.id) } },
          }),
        ).toBe(0);
      },
    );
    it("rejects excess, duplicate, self, missing, stranger, pending, inactive and blocked selections atomically", async () => {
      await save([1, 2]);
      await expect(save([1, 2, 3, 4, 5])).rejects.toThrow();
      await expect(save([1, 1])).rejects.toThrow();
      await expect(save([0])).rejects.toMatchObject({ status: 400 });
      await expect(
        service.updateTopFriends(actors[0].clerkId, {
          friendIds: ["missing"],
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(save([5])).rejects.toMatchObject({ status: 400 });
      await service.relationship(actors[0].clerkId, actors[5].id, "request");
      await expect(save([5])).rejects.toMatchObject({ status: 400 });
      await db.account.update({
        where: { userId: actors[3].id },
        data: { status: "DEACTIVATED" },
      });
      await expect(save([3])).rejects.toMatchObject({ status: 400 });
      await service.relationship(actors[4].clerkId, actors[0].id, "block");
      await expect(save([4])).rejects.toMatchObject({ status: 400 });
      await expectOrder([1, 2]);
    });
    it("derives the owner from the active session and rejects forged owners", async () => {
      await expect(
        service.updateTopFriends(actors[0].clerkId, {
          friendIds: ids([1]),
          requestId: randomUUID(),
          ownerId: actors[2].id,
        }),
      ).rejects.toThrow();
      await expect(
        service.updateTopFriends("unknown-subject", {
          friendIds: [],
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ status: 403 });
      await db.account.update({
        where: { userId: actors[0].id },
        data: { status: "DEACTIVATED" },
      });
      await expect(save([])).rejects.toMatchObject({ status: 403 });
      await expect(service.topFriends(actors[0].clerkId)).rejects.toMatchObject(
        { status: 403 },
      );
    });
    it("only returns the private profile selection to the owner or accepted friends, with read-time block protection", async () => {
      await save([1, 2]);
      expect(
        (
          await service.profile(actors[0].clerkId, actors[0].id)
        ).profile.topFriends?.map((p) => p.id),
      ).toEqual(ids([1, 2]));
      expect(
        (await service.profile(actors[3].clerkId, actors[0].id)).profile
          .topFriends,
      ).toHaveLength(2);
      expect(
        (await service.profile(actors[5].clerkId, actors[0].id)).profile,
      ).not.toHaveProperty("topFriends");
      await service.relationship(actors[0].clerkId, actors[5].id, "request");
      expect(
        (await service.profile(actors[5].clerkId, actors[0].id)).profile,
      ).not.toHaveProperty("topFriends");
      await db.block.create({
        data: { blockerId: actors[3].id, blockedId: actors[1].id },
      });
      expect(
        (
          await service.profile(actors[3].clerkId, actors[0].id)
        ).profile.topFriends?.map((p) => p.id),
      ).toEqual(ids([2]));
      await service.relationship(actors[3].clerkId, actors[0].id, "block");
      await expect(
        service.profile(actors[3].clerkId, actors[0].id),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("keeps selections through visibility changes and includes them in the private account export", async () => {
      await save([3, 1]);
      expect(
        (await service.identity(actors[0].clerkId)).preferences.showTopFriends,
      ).toBe(true);
      await service.updatePreferences(actors[0].clerkId, {
        showTopFriends: false,
      });
      for (const viewer of [0, 1])
        expect(
          (await service.profile(actors[viewer].clerkId, actors[0].id)).profile,
        ).not.toHaveProperty("topFriends");
      await expectOrder([3, 1]);
      const exported = await service.exportAccount(actors[0].clerkId);
      expect(exported.profile.showTopFriends).toBe(false);
      expect(exported.topFriends.map((p) => p.id)).toEqual(ids([3, 1]));
      await service.updatePreferences(actors[0].clerkId, {
        showTopFriends: true,
      });
      expect(
        (
          await service.profile(actors[1].clerkId, actors[0].id)
        ).profile.topFriends?.map((p) => p.id),
      ).toEqual(ids([3, 1]));
      expect(
        await db.memberNotification.count({
          where: { recipientId: actors[0].id },
        }),
      ).toBe(0);
    });
    it.each(["remove", "block"] as const)(
      "prunes both directions and normalizes order on %s",
      async (action) => {
        await save([3, 1, 4, 2]);
        await save([0], randomUUID(), 1);
        await service.updatePreferences(actors[0].clerkId, {
          showTopFriends: false,
        });
        await service.relationship(actors[1].clerkId, actors[0].id, action);
        await expectOrder([3, 4, 2]);
        expect(
          await db.profileTopFriend.count({ where: { ownerId: actors[1].id } }),
        ).toBe(0);
      },
    );
    it("prunes inbound and owned selections on deactivation", async () => {
      await save([3, 1, 4, 2]);
      await save([0], randomUUID(), 1);
      await service.deactivate(actors[1].clerkId);
      await expectOrder([3, 4, 2]);
      expect(
        await db.profileTopFriend.count({ where: { ownerId: actors[1].id } }),
      ).toBe(0);
    });
    it("prunes when a founder deactivates a reported account", async () => {
      await save([3, 1, 4, 2]);
      const report = await service.createReport(actors[0].clerkId, {
        target: {
          kind: "profile",
          id: actors[1].id,
          personId: actors[1].id,
          label: "Member",
        },
        reason: "harmful",
        details: "Review",
      });
      const moderation = new ModerationService(db, {
        put: async () => {},
        get: async () => new Uint8Array(),
        delete: async () => {},
      });
      await moderation.review(actors[6].clerkId, report.id, {
        action: "DEACTIVATE_ACCOUNT",
        note: "Confirmed report",
      });
      await expectOrder([3, 4, 2]);
    });
    it("filters stale rows immediately if an account or friendship changes outside application cleanup", async () => {
      await save([1, 2, 3]);
      await db.account.update({
        where: { userId: actors[1].id },
        data: { status: "DEACTIVATED" },
      });
      await db.friendship.deleteMany({
        where: {
          OR: [
            { lowId: actors[0].id, highId: actors[2].id },
            { lowId: actors[2].id, highId: actors[0].id },
          ],
        },
      });
      expect(
        (
          await service.profile(actors[0].clerkId, actors[0].id)
        ).profile.topFriends?.map((p) => p.id),
      ).toEqual(ids([3]));
    });
    it("makes duplicate and delayed retries safe without restoring an older list", async () => {
      const requestId = randomUUID();
      service = concurrentSnapshots(2);
      await Promise.all([save([1, 2], requestId), save([1, 2], requestId)]);
      await save([4, 3]);
      expect((await save([1, 2], requestId)).selected.map((p) => p.id)).toEqual(
        ids([4, 3]),
      );
      await expect(save([1], requestId)).rejects.toMatchObject({ status: 409 });
      await expectOrder([4, 3]);
    });
    it("serializes competing replacements without mixed or gapped lists", async () => {
      service = concurrentSnapshots(3);
      await Promise.all([save([4, 2, 1]), save([3, 1]), save([2, 4, 3, 1])]);
      const rows = await stored();
      expect(
        [
          [4, 2, 1],
          [3, 1],
          [2, 4, 3, 1],
        ].map(ids),
      ).toContainEqual(rows.map((row) => row.friendId));
      expect(rows.map((row) => row.position)).toEqual(
        rows.map((_, index) => index),
      );
    });
    it.each(["remove", "block"] as const)(
      "cannot restore an ineligible friend during concurrent %s and save",
      async (action) => {
        await save([1, 2]);
        await Promise.allSettled([
          save([3, 1, 4]),
          service.relationship(actors[1].clerkId, actors[0].id, action),
        ]);
        expect((await stored()).map((row) => row.friendId)).not.toContain(
          actors[1].id,
        );
        const rows = await stored();
        expect(rows.map((row) => row.position)).toEqual(rows.map((_, i) => i));
      },
    );
    it("lists only accepted active unblocked friends and never attaches selections to discovery", async () => {
      await save([1]);
      await service.relationship(actors[0].clerkId, actors[5].id, "request");
      expect(
        (await service.topFriends(actors[0].clerkId, "Friend")).contacts
          .map((r) => r.person.id)
          .sort(),
      ).toEqual(ids([1, 2, 3, 4]).sort());
      expect(
        (await service.topFriends(actors[0].clerkId, "Friend 2")).contacts.map(
          (r) => r.person.id,
        ),
      ).toEqual(ids([2]));
      expect(
        JSON.stringify(await service.contacts(actors[5].clerkId, "Friend")),
      ).not.toContain("topFriends");
    });
    it("enforces position, self, duplicate and foreign-key constraints in PostgreSQL", async () => {
      for (const position of [-1, 4])
        await expect(
          db.profileTopFriend.create({
            data: { ownerId: actors[0].id, friendId: actors[1].id, position },
          }),
        ).rejects.toThrow();
      await expect(
        db.profileTopFriend.create({
          data: { ownerId: actors[0].id, friendId: actors[0].id, position: 0 },
        }),
      ).rejects.toThrow();
      await save([1]);
      await expect(
        db.profileTopFriend.create({
          data: { ownerId: actors[0].id, friendId: actors[2].id, position: 0 },
        }),
      ).rejects.toThrow();
      await expect(
        db.profileTopFriend.create({
          data: { ownerId: actors[0].id, friendId: actors[1].id, position: 1 },
        }),
      ).rejects.toThrow();
      await expect(
        db.profileTopFriend.create({
          data: { ownerId: actors[0].id, friendId: "missing", position: 1 },
        }),
      ).rejects.toThrow();
      await db.user.delete({ where: { id: actors[1].id } });
      expect(
        await db.profileTopFriend.count({ where: { ownerId: actors[0].id } }),
      ).toBe(0);
    });
  },
);
