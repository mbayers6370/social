// Operator/scheduler entry point. No public job URL and no credential output.
import { PrismaPg } from "@prisma/adapter-pg";
import { invitationMaintenanceProvider } from "../src/server/account/invitation-maintenance.ts";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { synchronizeInvitations } from "../src/server/account/invitation-provider.ts";
if (process.argv.includes("--help")) {
  console.log(
    "Usage: npm run invitations:sync (retries pending Clerk revocations and expires invitation claims)",
  );
  process.exit(0);
}
if (!process.env.DATABASE_URL || !process.env.CLERK_SECRET_KEY)
  throw Error("Invitation synchronization requires configured services.");
const provider = invitationMaintenanceProvider();
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
try {
  const count = await synchronizeInvitations(db, provider);
  console.log(
    `Invitation reconciliation completed (${count} records checked).`,
  );
} catch {
  console.error(
    "Invitation reconciliation failed; pending records remain retryable. No credentials were logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
