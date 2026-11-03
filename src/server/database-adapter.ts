import { PrismaPg } from "@prisma/adapter-pg";

/** Prisma can dispatch independent relation reads on one transaction connection.
 * pg requires explicit pipelining for that concurrency; dependent application
 * queries still use await, and PostgreSQL retains transaction ordering/rollback.
 * https://node-postgres.com/features/pipelining
 */
export function createDatabaseAdapter(connectionString: string, max = 5) {
  return new PrismaPg({
    connectionString,
    max,
    pipeline: true,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}
