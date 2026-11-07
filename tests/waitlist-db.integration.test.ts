import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/server/database-adapter";
import { saveWaitlistEntry } from "@/server/waitlist";
import { privateTestDatabaseUrl } from "./helpers/database";

describe.skipIf(process.env.RUN_PRIVATE_DB_TESTS !== "1")(
  "private invitation waitlist",
  () => {
    let db: PrismaClient;
    const email = `${randomUUID()}@example.invalid`;
    beforeAll(() => {
      db = new PrismaClient({
        adapter: createDatabaseAdapter(privateTestDatabaseUrl().href, 4),
      });
    });
    afterAll(async () => {
      await db?.waitlistEntry.deleteMany({ where: { email } });
      await db?.$disconnect();
    });
    it("deduplicates concurrent submissions without touching the first consent timestamp", async () => {
      await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          saveWaitlistEntry(db, index % 2 ? email.toUpperCase() : email),
        ),
      );
      const first = await db.waitlistEntry.findUniqueOrThrow({
        where: { email },
      });
      await saveWaitlistEntry(db, email);
      expect(await db.waitlistEntry.count({ where: { email } })).toBe(1);
      expect(
        await db.waitlistEntry.findUniqueOrThrow({ where: { email } }),
      ).toEqual(first);
      expect(first.consentVersion).toBe("invitation-news-v1");
    });
  },
);
