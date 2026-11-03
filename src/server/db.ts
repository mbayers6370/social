import "server-only";
import { createDatabaseAdapter } from "./database-adapter";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseEnv } from "@/server/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let client: PrismaClient | undefined;

export function getDb() {
  if (client) return client;
  const { DATABASE_URL } = getDatabaseEnv();
  const adapter = createDatabaseAdapter(DATABASE_URL);
  client = globalForPrisma.prisma ?? new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}
