// First-account setup only. Uses an existing verified Clerk identity; no email or signup is sent.
// Output is a bearer URL. Redirect stdout into a private file.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { prepareFounderInvitation } from "../src/server/account/service.ts";
const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log(
    "Usage: npm run --silent account:bootstrap-founder -- --clerk-id user_ID --confirm-bootstrap > private-file",
  );
  process.exit(0);
}
if (
  args.length !== 3 ||
  args[0] !== "--clerk-id" ||
  !/^user_[A-Za-z0-9_-]{1,100}$/.test(args[1]) ||
  args[2] !== "--confirm-bootstrap" ||
  !process.env.CLERK_SECRET_KEY ||
  !process.env.DATABASE_URL ||
  !process.env.NEXT_PUBLIC_APP_URL
)
  throw Error(
    "Explicit first-founder setup and configured services are required. Use --help.",
  );
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL);
if (
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password ||
  (origin.protocol !== "https:" &&
    !(
      process.env.CLERK_SECRET_KEY.startsWith("sk_test_") &&
      ["localhost", "127.0.0.1"].includes(origin.hostname) &&
      origin.protocol === "http:"
    ))
)
  throw Error("A canonical HTTPS or local development origin is required.");
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
  const user = await response.json();
  const email = user.email_addresses?.find(
    (item) => item.id === user.primary_email_address_id,
  );
  if (
    user.id !== args[1] ||
    user.banned ||
    user.locked ||
    email?.verification?.status !== "verified"
  )
    throw Error("A verified existing identity is required");
  const token = await prepareFounderInvitation(db, {
    subject: user.id,
    verifiedEmail: email.email_address,
  });
  process.stdout.write(`${origin.origin}/invite/claim/${token}\n`);
} catch {
  console.error(
    "First-founder setup could not be prepared. It requires a verified existing identity and no ACTIVE accounts or competing founder reservation. No credentials were logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
