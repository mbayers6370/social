// Operator/scheduler entry point. No public job URL and no credential output.
import { PrismaPg } from "@prisma/adapter-pg";
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
async function request(path, method = "GET") {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Error("Provider reconciliation unavailable");
  return response.json();
}
// CLI gets only read/revoke capabilities; web issuance stays in Clerk's existing Next adapter.
const provider = {
  find: async (query) =>
    (
      await request(`/invitations?query=${encodeURIComponent(query)}&limit=100`)
    ).data.map((item) => ({
      id: item.id,
      emailAddress: item.email_address,
      status: item.status,
      publicMetadata: item.public_metadata,
    })),
  revoke: (id) =>
    request(`/invitations/${encodeURIComponent(id)}/revoke`, "POST"),
};
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
