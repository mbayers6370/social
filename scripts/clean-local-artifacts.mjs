import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = realpathSync(process.cwd());
const packagePath = join(root, "package.json");
if (!existsSync(packagePath))
  throw new Error("Run cleanup from the Margin repository root.");
const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
if (manifest.name !== "social-foundation")
  throw new Error("Refusing to clean an unexpected repository.");

const local = join(root, ".local");
const preserved = new Set([
  "auth-activation",
  "database.json",
  "local-review",
  "postgres",
  "postgres.log",
  "private-photos",
  "socket",
  "tools",
]);
const generated = [
  join(root, ".next"),
  join(local, "local-review", "next"),
  join(root, "blob-report"),
  join(root, "coverage"),
  join(root, "playwright-report"),
  join(root, "test-reports"),
  join(root, "test-results"),
];
if (existsSync(local))
  for (const entry of readdirSync(local))
    if (!preserved.has(entry)) generated.push(join(local, entry));

for (const target of generated) {
  const absolute = resolve(target);
  if (
    absolute !== target ||
    (!absolute.startsWith(`${local}/`) &&
      !generated
        .filter((entry) => !entry.startsWith(`${local}/`))
        .includes(absolute))
  )
    throw new Error(`Refusing unsafe cleanup target: ${target}`);
}

const existing = generated.filter(existsSync);
const arguments_ = process.argv.slice(2);
if (!arguments_.includes("--apply")) {
  process.stdout.write(
    existing.length
      ? `Dry run: ${existing.length} generated paths would be removed.\nRun npm run clean:local -- --apply to remove them.\n`
      : "No generated local artifacts need cleanup.\n",
  );
  process.exit(0);
}
if (arguments_.some((argument) => argument !== "--apply"))
  throw new Error("The only supported cleanup option is --apply.");
for (const target of existing) rmSync(target, { recursive: true, force: true });
process.stdout.write(
  `Removed ${existing.length} generated paths. Local database, private photographs, credentials, review certificate, and Node tools were preserved.\n`,
);
