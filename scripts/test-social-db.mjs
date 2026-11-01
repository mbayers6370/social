import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

// Uses the existing, password-protected local cluster. Never reads/writes .env,
// never migrates margin_local, and always creates a new disposable database.
if (Number(process.versions.node.split(".")[0]) !== 22)
  throw new Error("Use Node 22");
const root = resolve(import.meta.dirname, "..");
const bin =
  process.env.MARGIN_PG_BIN ??
  "/Applications/Postgres.app/Contents/Versions/latest/bin";
const ciDatabase =
  process.env.CI === "true" && process.env.MARGIN_CI_POSTGRES === "1";
// These are public fixture credentials for an ephemeral loopback-only CI service.
// They are never accepted for a configured user/production database.
const secrets = ciDatabase
  ? { admin: "a".repeat(64), owner: "b".repeat(64), runtime: "c".repeat(64) }
  : JSON.parse(readFileSync(join(root, ".local/database.json"), "utf8"));
if (
  ![secrets.admin, secrets.owner, secrets.runtime].every((x) =>
    /^[a-f0-9]{64}$/.test(x),
  )
)
  throw new Error("Invalid local credentials");
const database = `margin_slice_test_${randomUUID().replaceAll("-", "")}`;
function sql(user, password, db, input) {
  const result = spawnSync(
    join(bin, "psql"),
    [
      "-X",
      "-w",
      "-h",
      "127.0.0.1",
      "-p",
      "55432",
      "-U",
      user,
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: root,
      env: { ...process.env, PGPASSWORD: password },
      input,
      encoding: "utf8",
    },
  );
  if (result.status !== 0)
    throw new Error("Isolated local SQL command failed; no credentials logged");
}
const url = (role, password) =>
  `postgresql://${role}:${password}@127.0.0.1:55432/${database}?schema=public`;
let status = 1;
if (ciDatabase) {
  sql(
    "margin_admin",
    secrets.admin,
    "postgres",
    `CREATE ROLE margin_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${secrets.owner}'; CREATE ROLE margin_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${secrets.runtime}';`,
  );
}
sql(
  "margin_admin",
  secrets.admin,
  "postgres",
  `CREATE DATABASE ${database} OWNER margin_owner;`,
);
try {
  const env = {
    ...process.env,
    DATABASE_URL: url("margin_runtime", secrets.runtime),
    MIGRATION_DATABASE_URL: url("margin_owner", secrets.owner),
  };
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { cwd: root, env, encoding: "utf8" },
  );
  if (migrated.status !== 0)
    throw new Error("Isolated migration failed; credentials not logged");
  sql(
    "margin_owner",
    secrets.owner,
    database,
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO margin_runtime; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO margin_runtime; REVOKE ALL ON "_prisma_migrations" FROM margin_runtime;',
  );
  const tests = spawnSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/social-db.integration.test.ts",
    ],
    { cwd: root, env: { ...env, RUN_PRIVATE_DB_TESTS: "1" }, stdio: "inherit" },
  );
  status = tests.status ?? 1;
} finally {
  sql(
    "margin_admin",
    secrets.admin,
    "postgres",
    `DROP DATABASE ${database} WITH (FORCE);`,
  );
  if (ciDatabase)
    sql(
      "margin_admin",
      secrets.admin,
      "postgres",
      "DROP ROLE margin_runtime; DROP ROLE margin_owner;",
    );
}
process.exitCode = status;
