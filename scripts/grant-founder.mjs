// Explicit operator-only role assignment; never activates an account.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log(
    "Usage: npm run account:founder -- --clerk-id user_ID --confirm-founder",
  );
  process.exit(0);
}
if (
  args.length !== 3 ||
  args[0] !== "--clerk-id" ||
  !/^user_[A-Za-z0-9_-]{1,100}$/.test(args[1]) ||
  args[2] !== "--confirm-founder" ||
  !process.env.DATABASE_URL ||
  !process.env.CLERK_SECRET_KEY
)
  throw Error(
    "Explicit founder assignment and configured services are required. Use --help.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
try {
  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(args[1])}`,
    {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    },
  );
  if (!response.ok) throw Error("Identity unavailable");
  const identity = await response.json();
  const email = identity.email_addresses?.find(
    (email) => email.id === identity.primary_email_address_id,
  );
  if (
    identity.id !== args[1] ||
    identity.banned ||
    identity.locked ||
    email?.verification?.status !== "verified"
  )
    throw Error("A currently verified, available identity is required");
  const owner = await db.user.findUnique({
    where: { clerkId: identity.id },
    include: { account: true },
  });
  if (owner?.account?.status !== "ACTIVE" || !owner.account.onboardedAt)
    throw Error(
      "Only an approved, onboarded ACTIVE account can become founder",
    );
  const granted = await db.account.updateMany({
    where: { userId: owner.id, status: "ACTIVE", onboardedAt: { not: null } },
    data: { role: "FOUNDER" },
  });
  if (granted.count !== 1) throw Error("Account eligibility changed");
  console.log(
    "Founder role granted to the selected account. No account was activated.",
  );
} catch {
  console.error(
    "Founder assignment failed. Confirm the account is verified, onboarded and ACTIVE; no credentials were logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
