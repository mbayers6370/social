// Actual disposable PostgreSQL; Clerk and storage use controlled doubles.
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
import { PrismaClient } from "@/generated/prisma/client";
import { privateTestDatabaseUrl } from "./helpers/database";
import { createDatabaseAdapter } from "@/server/database-adapter";
import {
  AccountErasureService,
  type ErasureProvider,
} from "@/server/account/erasure";
import { MemberService } from "@/server/member/service";
import { completeAccountOnboarding } from "@/server/account/service";
import type { ErasureJournal } from "@/server/account/erasure-journal";
import {
  exportErasureReceipts,
  importErasureReceipts,
} from "@/server/account/erasure-receipts";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "account erasure with real PostgreSQL",
  () => {
    let db: PrismaClient;
    let now: Date;
    let people: { id: string; clerkId: string }[];
    let service: AccountErasureService;
    const bytes = new Map<string, Uint8Array>();
    const receipts = new Map<string, Parameters<ErasureJournal["write"]>[0]>();
    const journal: ErasureJournal = {
      write: vi.fn(async (value) => {
        receipts.set(`erasure/${value.userId}.json`, structuredClone(value));
      }),
      read: vi.fn(async (key) => receipts.get(key)!),
      list: vi.fn(async () => ({ keys: [...receipts.keys()], hasMore: false })),
      delete: vi.fn(async (key) => {
        receipts.delete(key);
      }),
    };
    const store = {
      put: vi.fn(async (key: string, data: Uint8Array) => {
        bytes.set(key, data);
      }),
      get: vi.fn(async (key: string) => bytes.get(key)!),
      delete: vi.fn(async (key: string) => {
        bytes.delete(key);
      }),
    };
    const provider = {
      find: vi.fn<ErasureProvider["find"]>().mockResolvedValue([]),
      revoke: vi.fn(async () => ({})),
      deleteUser: vi.fn<ErasureProvider["deleteUser"]>().mockResolvedValue(),
    };
    beforeAll(() => {
      db = new PrismaClient({
        adapter: createDatabaseAdapter(privateTestDatabaseUrl().href, 8),
      });
    });
    beforeEach(async () => {
      now = new Date("2026-11-05T12:00:00Z");
      bytes.clear();
      receipts.clear();
      vi.clearAllMocks();
      provider.deleteUser.mockReset().mockResolvedValue();
      provider.find.mockReset().mockResolvedValue([]);
      people = [];
      for (let i = 0; i < 2; i++)
        people.push(
          await db.user.create({
            data: {
              clerkId: `erasure-${randomUUID()}`,
              account: {
                create: { status: "ACTIVE", displayName: "Erasure canary" },
              },
            },
            select: { id: true, clerkId: true },
          }),
        );
      service = new AccountErasureService(db, store, () => now, journal);
    });
    afterEach(async () => {
      const ids = [
        ...people.map((p) => p.id),
        ...[...receipts.keys()].map((key) =>
          key.slice("erasure/".length, -".json".length),
        ),
      ];
      await db.operatorAction.deleteMany({
        where: { operatorId: { in: ids } },
      });
      await db.safetyReport.deleteMany({ where: { reporterId: { in: ids } } });
      await db.invitation.deleteMany({ where: { createdBy: { in: ids } } });
      await db.invitationLink.deleteMany({ where: { createdBy: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.accountErasure.deleteMany({ where: { userId: { in: ids } } });
    });
    afterAll(async () => db?.$disconnect());
    it("atomically queues one request under retries/concurrency and immediately denies the member", async () => {
      await Promise.all([
        service.request(people[0].clerkId),
        service.request(people[0].clerkId),
      ]);
      expect(
        await db.accountErasure.count({ where: { userId: people[0].id } }),
      ).toBe(1);
      await expect(
        new MemberService(db, store).identity(people[0].clerkId),
      ).rejects.toMatchObject({ status: 403 });
      expect(provider.deleteUser).not.toHaveBeenCalled();
    });
    it("does not acknowledge acceptance or destructively clean data until the independent journal is written", async () => {
      const post = await db.post.create({
        data: {
          ownerId: people[0].id,
          body: "Journal outage canary",
          hasLink: false,
          dayKey: "2026-11-05",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
        },
      });
      vi.mocked(journal.write).mockRejectedValueOnce(Error("journal offline"));
      await expect(service.request(people[0].clerkId)).rejects.toThrow();
      expect(
        (
          await db.account.findUniqueOrThrow({
            where: { userId: people[0].id },
          })
        ).status,
      ).toBe("DEACTIVATED");
      vi.mocked(journal.write).mockRejectedValueOnce(
        Error("journal still offline"),
      );
      await expect(service.process(provider)).rejects.toThrow(
        "Account erasure needs retry",
      );
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      expect(provider.deleteUser).not.toHaveBeenCalled();
      await service.request(people[0].clerkId);
      now = new Date(now.getTime() + 60_000);
      await service.process(provider);
      expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull();
      expect(receipts.get(`erasure/${people[0].id}.json`)?.clerkId).toBeNull();
    });
    it("retains an uncertain invitation send until provider reconciliation confirms revocation", async () => {
      const link = await db.invitationLink.create({
        data: {
          createdBy: people[0].id,
          digest: randomUUID(),
          requestId: randomUUID(),
          createdAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
        },
      });
      const invitation = await db.invitation.create({
        data: {
          linkId: link.id,
          createdBy: people[0].id,
          digest: randomUUID(),
          email: "recipient@example.test",
          expiresAt: link.expiresAt,
          deliveryAttemptedAt: now,
        },
      });
      await service.request(people[0].clerkId);
      expect((await service.process(provider)).pending).toBe(1);
      expect(
        await db.invitation.findUnique({ where: { id: invitation.id } }),
      ).not.toBeNull();
      provider.find.mockResolvedValue([
        {
          id: "invitation-fixture",
          emailAddress: "recipient@example.test",
          status: "pending",
          publicMetadata: { marginInvitationId: invitation.id },
        },
      ]);
      now = new Date(now.getTime() + 60_000);
      expect((await service.process(provider)).completed).toBe(1);
      expect(provider.revoke).toHaveBeenCalledWith("invitation-fixture");
      expect(
        await db.invitationLink.findUnique({ where: { id: link.id } }),
      ).toBeNull();
    });
    it("removes account, comments, messages, reports and provider identity, preserving another member and shared Space", async () => {
      const room = await db.space.create({
        data: {
          name: "Shared Space",
          kind: "PRIVATE",
          creatorId: people[0].id,
          memberships: {
            create: [
              { userId: people[0].id, role: "ADMIN" },
              { userId: people[1].id },
            ],
          },
        },
      });
      const post = await db.post.create({
        data: {
          ownerId: people[1].id,
          spaceId: room.id,
          body: "Other member content",
          hasLink: false,
          dayKey: "2026-11-05",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
        },
      });
      await db.postComment.create({
        data: {
          postId: post.id,
          authorId: people[0].id,
          body: "Private comment canary",
        },
      });
      await db.memberMessage.create({
        data: {
          senderId: people[0].id,
          recipientId: people[1].id,
          body: "Private message canary",
          requestId: randomUUID(),
        },
      });
      const report = await db.safetyReport.create({
        data: {
          reporterId: people[1].id,
          targetKind: "profile",
          targetId: people[0].id,
          targetPersonId: people[0].id,
          reason: "other",
          details: "Private report canary",
        },
      });
      await db.operatorAction.create({
        data: {
          operatorId: people[1].id,
          reportId: report.id,
          action: "DISMISS",
          targetId: people[0].id,
          note: "Private note canary",
        },
      });
      await service.request(people[0].clerkId);
      expect((await service.process(provider)).completed).toBe(1);
      expect(provider.deleteUser).toHaveBeenCalledWith(people[0].clerkId);
      expect(
        await db.user.findUnique({ where: { id: people[0].id } }),
      ).toBeNull();
      expect(
        await db.user.findUnique({ where: { id: people[1].id } }),
      ).not.toBeNull();
      expect(
        (await db.space.findUniqueOrThrow({ where: { id: room.id } }))
          .creatorId,
      ).toBe(people[1].id);
      expect(
        await db.post.findUnique({ where: { id: post.id } }),
      ).not.toBeNull();
      expect(
        await db.postComment.count({ where: { authorId: people[0].id } }),
      ).toBe(0);
      expect(
        await db.memberMessage.count({ where: { senderId: people[0].id } }),
      ).toBe(0);
      expect(
        await db.safetyReport.findUnique({ where: { id: report.id } }),
      ).toBeNull();
      expect(
        await db.operatorAction.findFirst({ where: { reportId: report.id } }),
      ).toBeNull();
      const receipt = await db.accountErasure.findUniqueOrThrow({
        where: { userId: people[0].id },
      });
      expect(receipt.clerkId).toBeNull();
      expect(receipt.completedAt).not.toBeNull();
    });
    it("retains private-object retry records until storage deletion succeeds", async () => {
      const key = `social/${randomUUID()}.webp`;
      bytes.set(key, new Uint8Array([1, 2, 3]));
      const photo = await db.photo.create({
        data: {
          ownerId: people[0].id,
          objectKey: key,
          state: "READY",
          dayKey: "2026-11-05",
          uploadExpiresAt: now,
          description: "Private photo",
          width: 10,
          height: 10,
          byteLength: 3,
          uploadedAt: now,
        },
      });
      await service.request(people[0].clerkId);
      expect((await service.process(provider)).pending).toBe(1);
      expect(
        (await db.photo.findUniqueOrThrow({ where: { id: photo.id } })).state,
      ).toBe("DELETE_PENDING");
      store.delete.mockRejectedValueOnce(Error("PRIVATE_STORAGE_CANARY"));
      const member = new MemberService(db, store, () => now);
      await expect(member.purgeDeletedPhotos()).rejects.toThrow();
      expect(bytes.has(key)).toBe(true);
      await member.purgeDeletedPhotos();
      now = new Date(now.getTime() + 60_000);
      expect((await service.process(provider)).completed).toBe(1);
      expect(bytes.has(key)).toBe(false);
      expect(await db.photo.findUnique({ where: { id: photo.id } })).toBeNull();
    });
    it("keeps a durable retry after provider failure and handles already-deleted webhook duplicates", async () => {
      provider.deleteUser.mockRejectedValueOnce(
        Error("PRIVATE_PROVIDER_CANARY"),
      );
      await service.request(people[0].clerkId);
      await expect(service.process(provider)).rejects.toThrow(
        "Account erasure needs retry",
      );
      expect(
        await db.user.findUnique({ where: { id: people[0].id } }),
      ).not.toBeNull();
      now = new Date(now.getTime() + 60_000);
      await service.process(provider);
      await service.request(people[0].clerkId, true);
      expect(
        await db.accountErasure.count({ where: { userId: people[0].id } }),
      ).toBe(1);
      await service.request(people[1].clerkId, true);
      provider.deleteUser.mockClear();
      await service.process(provider);
      expect(provider.deleteUser).not.toHaveBeenCalled();
    });
    it("does not permit the last active founder to accidentally orphan operations", async () => {
      await db.account.update({
        where: { userId: people[0].id },
        data: { role: "FOUNDER" },
      });
      await expect(service.request(people[0].clerkId)).rejects.toMatchObject({
        status: 409,
      });
      expect(
        await db.accountErasure.count({ where: { userId: people[0].id } }),
      ).toBe(0);
      await db.account.update({
        where: { userId: people[1].id },
        data: { role: "FOUNDER" },
      });
      await service.request(people[0].clerkId);
      expect(
        (
          await db.account.findUniqueOrThrow({
            where: { userId: people[0].id },
          })
        ).status,
      ).toBe("DEACTIVATED");
    });
    it("reapplies an erasure after restored account data and removes receipts after 90 days", async () => {
      await service.request(people[0].clerkId);
      await service.process(provider);
      await db.user.create({
        data: {
          id: people[0].id,
          clerkId: people[0].clerkId,
          account: { create: { status: "ACTIVE" } },
        },
      });
      await service.process(provider);
      expect(
        await db.user.findUnique({ where: { id: people[0].id } }),
      ).toBeNull();
      expect(provider.deleteUser).toHaveBeenCalledTimes(2);
      now = new Date(now.getTime() + 90 * 86_400_000 + 1);
      await service.process(provider);
      expect(
        await db.accountErasure.findUnique({ where: { userId: people[0].id } }),
      ).toBeNull();
    });
    it("restores a newer independent deletion journal before an older DB snapshot can revive an account", async () => {
      await service.request(people[0].clerkId);
      await service.process(provider);
      const archive = JSON.parse(
        JSON.stringify(await exportErasureReceipts(db)),
      );
      await db.accountErasure.deleteMany({ where: { userId: people[0].id } });
      await db.user.create({
        data: {
          id: people[0].id,
          clerkId: people[0].clerkId,
          account: { create: { status: "ACTIVE" } },
        },
      });
      await importErasureReceipts(db, archive, now);
      await expect(
        new MemberService(db, store).identity(people[0].clerkId),
      ).rejects.toMatchObject({ status: 403 });
      await service.process(provider);
      expect(
        await db.user.findUnique({ where: { id: people[0].id } }),
      ).toBeNull();
    });
    it("also deletes a provider-only identity that never completed onboarding", async () => {
      const subject = `provider-only-${randomUUID()}`;
      await service.request(subject);
      await expect(
        completeAccountOnboarding(
          db,
          { subject, verifiedEmail: "erasure-canary@example.test" },
          { name: "Erasure canary", username: "erasurecanary", bio: "" },
          null,
          now,
        ),
      ).rejects.toThrow("This account is being deleted.");
      expect(
        await db.user.findUnique({ where: { clerkId: subject } }),
      ).toBeNull();
      await service.process(provider);
      expect(provider.deleteUser).toHaveBeenCalledWith(subject);
      const receipt = await db.accountErasure.findFirst({
        where: { userId: { startsWith: "identity-" } },
      });
      expect(receipt?.clerkId).toBeNull();
      expect(receipt?.completedAt).not.toBeNull();
      await db.accountErasure.deleteMany({
        where: { userId: { startsWith: "identity-" } },
      });
    });
  },
);
