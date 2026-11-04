// Dedicated worker, never imported by Next request handlers. Logs aggregate counts only.
if (process.argv.includes("--help")) {
  console.log(
    "Usage: npm run maintenance:run | maintenance:work | maintenance:status. Requires Node 22, MARGIN_MAINTENANCE_ENABLED=1 and the reviewed runtime database. The worker runs every minute. This command permanently deletes expired content; configure only the intended environment.",
  );
  process.exit(0);
}
const mode = process.argv[2];
if (!["run", "work", "status"].includes(mode) || process.argv.length !== 3)
  throw Error("Choose run, work or status.");
if (process.env.MARGIN_MAINTENANCE_ENABLED !== "1")
  throw Error("Maintenance requires explicit MARGIN_MAINTENANCE_ENABLED=1.");
const { PrismaClient } = await import("../src/generated/prisma/client.ts");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { runMaintenanceCycle, maintenanceHealth } =
  await import("../src/server/jobs/maintenance.ts");
const { maintenanceWorker } = await import("../src/server/jobs/worker.ts");
const { privatePhotoStore } = await import("../src/server/social/photo.ts");
const { invitationMaintenanceProvider } =
  await import("../src/server/account/invitation-maintenance.ts");
const { getDatabaseEnv } = await import("../src/server/env.ts");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getDatabaseEnv().DATABASE_URL,
    max: 6,
    pipeline: true,
    connectionTimeoutMillis: 5000,
    statement_timeout: 20_000,
    query_timeout: 25_000,
  }),
});
const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
async function run() {
  const result = await runMaintenanceCycle(
    db,
    privatePhotoStore,
    invitationMaintenanceProvider(),
  );
  for (const job of result) {
    const log = job.status === "failed" ? console.error : console.log;
    log(JSON.stringify({ at: new Date().toISOString(), ...job }));
  }
  return result;
}
try {
  if (mode === "work") await maintenanceWorker(run, controller.signal);
  else if (mode === "run") {
    if ((await run()).some((job) => job.status === "failed"))
      process.exitCode = 1;
  } else {
    const health = await maintenanceHealth(db);
    console.log(JSON.stringify(health));
    if (health.some((job) => !job.healthy)) process.exitCode = 1;
  }
} catch {
  console.error(
    "Maintenance failed. Check service availability and aggregate job health; no private data was logged.",
  );
  process.exitCode = 1;
} finally {
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
  await db.$disconnect();
}
