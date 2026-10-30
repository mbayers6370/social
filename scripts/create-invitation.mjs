// Operator-only provisioning. Never import into the application runtime.
// Writes a raw single-use code to stdout only; redirect into a private file.
import { randomBytes, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
if (
  process.env.MARGIN_REGISTRATION_ENABLED !== "1" ||
  !process.env.DATABASE_URL
)
  throw Error(
    "Registration must be explicitly enabled and a database configured.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
try {
  const code = randomBytes(32).toString("base64url");
  const email = process.env.MARGIN_INVITATION_EMAIL?.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Invalid invitation email.");
  await db.invitation.create({
    data: {
      digest: createHash("sha256").update(code).digest("hex"),
      email: email || null,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  process.stdout.write(`${code}\n`);
} finally {
  await db.$disconnect();
}
