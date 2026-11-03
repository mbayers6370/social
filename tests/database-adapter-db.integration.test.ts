// @vitest-environment node
// Real disposable PostgreSQL, no Clerk/Redis credentials or member data.
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
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "runtime PostgreSQL adapter",
  () => {
    let db: PrismaClient;
    const subjects: string[] = [];
    let warnings: string[] = [];
    const record = (warning: Error) => warnings.push(warning.message);
    beforeEach(() => {
      warnings = [];
      process.on("warning", record);
    });
    afterEach(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      process.off("warning", record);
      await db.user.deleteMany({
        where: { clerkId: { in: subjects.splice(0) } },
      });
      expect(
        warnings.filter((message) => message.includes("client.query()")),
      ).toEqual([]);
    });
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "55432" ||
        !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
        url.username !== "margin_runtime"
      )
        throw Error("Refusing non-disposable database");
      // One connection makes every test exercise actual connection reuse.
      db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 1) });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it("runs concurrent transaction reads with ordered results and no query overlap warning", async () => {
      const rows = await db.$transaction(async (tx) =>
        Promise.all([
          tx.$queryRaw<
            { value: number }[]
          >`SELECT 1::int AS value FROM pg_sleep(0.02)`,
          tx.$queryRaw<{ value: number }[]>`SELECT 2::int AS value`,
          tx.$queryRaw<{ value: number }[]>`SELECT 3::int AS value`,
        ]),
      );
      expect(rows).toEqual([[{ value: 1 }], [{ value: 2 }], [{ value: 3 }]]);
    });

    it("reads multiple relations after a write without overlapping an unconfigured client", async () => {
      const subject = `adapter-${randomUUID()}`;
      subjects.push(subject);
      const user = await db.user.create({
        data: {
          clerkId: subject,
          account: {
            create: { status: "ACTIVE", displayName: "Adapter member" },
          },
        },
      });
      const updated = await db.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
        include: { account: true, posts: true, photos: true, gallery: true },
      });
      expect(updated.account?.displayName).toBe("Adapter member");
      expect(updated.posts).toEqual([]);
      expect(updated.photos).toEqual([]);
      expect(updated.gallery).toEqual([]);
    });

    it("rolls back failed transactions and safely reuses the pooled connection", async () => {
      const subject = `rollback-${randomUUID()}`;
      subjects.push(subject);
      await expect(
        db.$transaction(async (tx) => {
          await tx.user.create({ data: { clerkId: subject } });
          await tx.$queryRaw`SELECT 1 / 0`;
        }),
      ).rejects.toThrow();
      expect(
        await db.user.findUnique({ where: { clerkId: subject } }),
      ).toBeNull();
      expect(await db.$queryRaw`SELECT 42::int AS value`).toEqual([
        { value: 42 },
      ]);
    });

    it("keeps dependent writes and reads in the same serializable transaction", async () => {
      const subject = `ordered-${randomUUID()}`;
      subjects.push(subject);
      const result = await db.$transaction(
        async (tx) => {
          const user = await tx.user.create({ data: { clerkId: subject } });
          await tx.account.create({
            data: {
              userId: user.id,
              status: "ACTIVE",
              displayName: "Saved in order",
            },
          });
          return tx.user.findUnique({
            where: { id: user.id },
            include: { account: true },
          });
        },
        { isolationLevel: "Serializable" },
      );
      expect(result?.account?.displayName).toBe("Saved in order");
    });
  },
);
