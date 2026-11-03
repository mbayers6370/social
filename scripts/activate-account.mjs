// Operator-only approval. Never imported into the application or exposed as an API.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  activateAccount,
  AccountSetupError,
} from "../src/server/account/service.ts";
const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log(
    "Usage: npm run account:activate -- --clerk-id user_ID --confirm-activation",
  );
  process.exit(0);
}
if (
  args.length !== 3 ||
  args[0] !== "--clerk-id" ||
  !/^user_[A-Za-z0-9_-]{1,100}$/.test(args[1]) ||
  args[2] !== "--confirm-activation" ||
  !process.env.CLERK_SECRET_KEY ||
  !process.env.DATABASE_URL ||
  process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1"
) {
  console.error(
    "Explicit account approval, Clerk credentials, the private backend flag and a database are required. Use --help.",
  );
  process.exit(1);
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
try {
  // A read-only Backend API call keeps the CLI independent of Next's request runtime.
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
    (email) => email.id === user.primary_email_address_id,
  );
  if (
    user.id !== args[1] ||
    user.banned ||
    user.locked ||
    email?.verification?.status !== "verified"
  )
    throw new AccountSetupError(
      "Approval requires a currently verified, available Clerk identity.",
    );
  await activateAccount(db, {
    subject: user.id,
    verifiedEmail: email.email_address,
  });
  console.log("Account activated.");
} catch (error) {
  console.error(
    error instanceof AccountSetupError
      ? error.message
      : "Account approval failed. Check the configured services; no credentials were logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
