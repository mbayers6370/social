import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
} from "node:fs";
import { parseEnv } from "node:util";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

// An isolated, password-protected local cluster. Never touches an existing database.
const root = resolve(import.meta.dirname, "..");
const local = join(root, ".local");
const data = join(local, "postgres");
const socket = join(local, "socket");
const bin =
  process.env.MARGIN_PG_BIN ??
  "/Applications/Postgres.app/Contents/Versions/latest/bin";
const port = "55432";
function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${program.split("/").at(-1)} failed. No credentials are included in this error.`,
    );
  return result.stdout;
}
const command = process.argv[2] ?? "setup";
if (!["setup", "stop"].includes(command)) throw new Error("Use setup or stop.");
if (!existsSync(join(bin, "pg_ctl")))
  throw new Error(
    "Install PostgreSQL locally or set MARGIN_PG_BIN to its bin directory.",
  );
if (command === "stop") {
  run(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log("Stopped Margin's isolated local PostgreSQL.");
  process.exit(0);
}
mkdirSync(local, { recursive: true, mode: 0o700 });
mkdirSync(socket, { recursive: true, mode: 0o700 });
const secretsFile = join(local, "database.json");
const secrets = existsSync(secretsFile)
  ? JSON.parse(readFileSync(secretsFile, "utf8"))
  : {
      admin: randomBytes(32).toString("hex"),
      owner: randomBytes(32).toString("hex"),
      runtime: randomBytes(32).toString("hex"),
    };
const runtimeUrl = `postgresql://margin_runtime:${secrets.runtime}@127.0.0.1:${port}/margin_local?schema=public`;
if (
  ![secrets.admin, secrets.owner, secrets.runtime].every(
    (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
  )
)
  throw new Error(
    "Local database credentials are invalid. Nothing was changed.",
  );
const ownerUrl = `postgresql://margin_owner:${secrets.owner}@127.0.0.1:${port}/margin_local?schema=public`;
const envFile = join(root, ".env");
const existingEnv = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const existingValues = parseEnv(existingEnv);
const templateUrl =
  "postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public";
if (
  (existingValues.DATABASE_URL &&
    ![runtimeUrl, templateUrl].includes(existingValues.DATABASE_URL)) ||
  (existingValues.MIGRATION_DATABASE_URL &&
    existingValues.MIGRATION_DATABASE_URL !== ownerUrl)
)
  throw new Error(
    "An existing .env is configured elsewhere. Nothing was changed. Use a separate checkout for this local cluster.",
  );
writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
if (!existsSync(join(data, "PG_VERSION"))) {
  const passwordFile = join(local, "init-password");
  writeFileSync(passwordFile, secrets.admin, { mode: 0o600 });
  try {
    run(join(bin, "initdb"), [
      "-D",
      data,
      "-U",
      "margin_admin",
      "--auth-local=scram-sha-256",
      "--auth-host=scram-sha-256",
      "--encoding=UTF8",
      "--no-locale",
      `--pwfile=${passwordFile}`,
    ]);
  } finally {
    unlinkSync(passwordFile);
  }
}
const running =
  spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"], { encoding: "utf8" })
    .status === 0;
if (!running)
  run(join(bin, "pg_ctl"), [
    "-D",
    data,
    "-l",
    join(local, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k '${socket.replaceAll("'", "'\\''")}'`,
    "-w",
    "start",
  ]);
function sql(user, password, database, input) {
  return run(
    join(bin, "psql"),
    [
      "-X",
      "-w",
      "-h",
      "127.0.0.1",
      "-p",
      port,
      "-U",
      user,
      "-d",
      database,
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { env: { ...process.env, PGPASSWORD: password }, input },
  );
}
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
for (const [user, password] of [
  ["margin_owner", secrets.owner],
  ["margin_runtime", secrets.runtime],
]) {
  if (
    sql(
      "margin_admin",
      secrets.admin,
      "postgres",
      `SELECT 1 FROM pg_roles WHERE rolname=${literal(user)}`,
    ).trim() !== "1"
  )
    sql(
      "margin_admin",
      secrets.admin,
      "postgres",
      `CREATE ROLE ${user} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${literal(password)};`,
    );
}
if (
  sql(
    "margin_admin",
    secrets.admin,
    "postgres",
    "SELECT 1 FROM pg_database WHERE datname='margin_local'",
  ).trim() !== "1"
)
  sql(
    "margin_admin",
    secrets.admin,
    "postgres",
    "CREATE DATABASE margin_local OWNER margin_owner;",
  );
sql(
  "margin_owner",
  secrets.owner,
  "margin_local",
  "REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO margin_runtime; ALTER DEFAULT PRIVILEGES FOR ROLE margin_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO margin_runtime;",
);
let nextEnv =
  existingEnv ||
  "# Local-only configuration; never commit this file.\nNEXT_PUBLIC_APP_URL=http://localhost:3000\n";
for (const [key, value] of [
  ["DATABASE_URL", runtimeUrl],
  ["MIGRATION_DATABASE_URL", ownerUrl],
]) {
  const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, "m");
  nextEnv = pattern.test(nextEnv)
    ? nextEnv.replace(pattern, `${key}=${value}`)
    : `${nextEnv.trimEnd()}\n${key}=${value}\n`;
}
if (nextEnv !== existingEnv) writeFileSync(envFile, nextEnv, { mode: 0o600 });
chmodSync(envFile, 0o600);
run(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    env: {
      ...process.env,
      DATABASE_URL: runtimeUrl,
      MIGRATION_DATABASE_URL: ownerUrl,
    },
  },
);
sql(
  "margin_owner",
  secrets.owner,
  "margin_local",
  'REVOKE ALL ON TABLE "_prisma_migrations" FROM margin_runtime;',
);
console.log(
  "Margin local PostgreSQL is ready on 127.0.0.1:55432. Runtime and migration roles are separate; credentials are in ignored local files.",
);
