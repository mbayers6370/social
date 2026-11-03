// Operator convenience for an existing ACTIVE member. The same quota/role service applies.
// Writes a bearer URL to stdout only; redirect into a private file.
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { issueInvitationLink } from "../src/server/account/invitation-links.ts";
const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log(
    "Usage: npm run --silent account:invite -- --clerk-id user_ID > private-file",
  );
  process.exit(0);
}
if (
  args.length !== 2 ||
  args[0] !== "--clerk-id" ||
  !/^user_[A-Za-z0-9_-]{1,100}$/.test(args[1]) ||
  !process.env.DATABASE_URL ||
  !process.env.NEXT_PUBLIC_APP_URL
)
  throw Error(
    "An existing member, database and application origin are required. Use --help.",
  );
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL);
if (
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password ||
  !["http:", "https:"].includes(origin.protocol)
)
  throw Error("Invalid application origin.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
try {
  const { token } = await issueInvitationLink(db, args[1], {
    requestId: randomUUID(),
  });
  process.stdout.write(`${origin.origin}/invite/${token}\n`);
} catch {
  console.error(
    "Invitation issuance failed. Confirm the member is active, invitations are enabled, and the allowance and signing configuration are available.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
