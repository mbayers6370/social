import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const codeOnly = process.argv.includes("--code-only");
const quick = process.argv.includes("--quick");
const testFiles = process.argv
  .slice(2)
  .filter((argument) => !["--code-only", "--quick"].includes(argument));
if (codeOnly && quick) throw new Error("Choose either --quick or --code-only.");
if (
  testFiles.length &&
  (!quick ||
    testFiles.some(
      (file) =>
        !/^tests\/.+\.test\.tsx?$/.test(file) ||
        !existsSync(path.join(root, file)),
    ))
)
  throw new Error(
    "Test file filters require --quick and existing tests/*.test.ts(x) paths.",
  );
const requiredNode = Number(
  readFileSync(path.join(root, ".nvmrc"), "utf8").trim().split(".")[0],
);
if (!codeOnly && Number(process.versions.node.split(".")[0]) !== requiredNode)
  throw new Error(
    `Full verification requires Node ${requiredNode}, matching CI. Switch to the project's Node version before verifying or pushing.`,
  );
const git = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
);
if (git.status !== 0)
  throw new Error("Run verification from the Margin repository.");
const sensitive = (name) =>
  (/(^|\/)(?:\.env(?:\..*)?|\.local|\.aws|\.ssh|node_modules|\.next|playwright-report|test-results)(?:\/|$)/.test(
    name,
  ) &&
    !/\.env(?:\..*)?\.example$/.test(name)) ||
  /\.(?:pem|key|p12|pfx|p8)$/.test(name);
const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (tracked.stdout.split("\0").some((name) => name && sensitive(name)))
  throw new Error(
    "Private or generated files are tracked. Review git ls-files before publishing.",
  );
// Private-backend regressions must pass against actual PostgreSQL on every push.
// This runner creates/drops its own database; .env and the preview DB are untouched.
if (!codeOnly && !quick) {
  process.stdout.write(
    "\nChecking isolated private-backend PostgreSQL tests…\n",
  );
  const database = spawnSync("npm", ["run", "test:social-db"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (database.status !== 0)
    throw new Error("Private-backend database verification failed.");
}
mkdirSync(path.join(root, ".local"), { recursive: true });
const snapshot = mkdtempSync(path.join(root, ".local", "verify-"));
let passed = false;
try {
  for (const name of new Set(git.stdout.split("\0").filter(Boolean))) {
    if (sensitive(name) || !existsSync(path.join(root, name))) continue;
    mkdirSync(path.dirname(path.join(snapshot, name)), { recursive: true });
    cpSync(path.join(root, name), path.join(snapshot, name));
  }
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(snapshot, "node_modules"),
    "dir",
  );
  if (existsSync(path.join(root, "src/generated")))
    cpSync(
      path.join(root, "src/generated"),
      path.join(snapshot, "src/generated"),
      { recursive: true },
    );
  // The shared dependency directory is outside the snapshot's package root.
  // Only this disposable config changes; the open development server is untouched.
  // Hide the development indicator so it cannot cover phone-sized app controls.
  // Next still surfaces compilation and runtime errors with the indicator disabled.
  const config = path.join(snapshot, "next.config.ts");
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace(
      "const nextConfig: NextConfig = {",
      `const nextConfig: NextConfig = {\n  devIndicators: false,\n  turbopack: { root: ${JSON.stringify(root)} },`,
    ),
  );
  const env = {
    ...process.env,
    PLAYWRIGHT_PRODUCTION: "",
    RUN_LOCAL_DB_TESTS: "",
    RUN_LIVE_MUSIC_TEST: "",
    RUN_PRIVATE_DB_TESTS: "",
  };
  delete env.PLAYWRIGHT_BASE_URL;
  for (const [, key] of readFileSync(
    path.join(root, ".env.example"),
    "utf8",
  ).matchAll(/^([A-Z][A-Z0-9_]*)=/gm))
    env[key] = "";
  env.SENTRY_AUTH_TOKEN = "";
  const run = (label, args, extra = {}) => {
    process.stdout.write(`\nChecking ${label}…\n`);
    const result = spawnSync("npm", args, {
      cwd: snapshot,
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    if (result.status !== 0)
      throw new Error(
        `${label} failed${result.error ? `: ${result.error.message}` : ""}.`,
      );
  };
  if (Number(process.versions.node.split(".")[0]) !== 22)
    process.stdout.write(
      `Using Node ${process.versions.node}; CI uses the Node 22 version declared in .nvmrc.\n`,
    );
  for (const script of ["format:check", "typecheck", "lint", "styles:check"])
    run(script, ["run", script]);
  run("unit tests", [
    "run",
    "test",
    ...(testFiles.length ? ["--", ...testFiles] : []),
  ]);
  if (!quick) run("build", ["run", "build"]);
  if (!codeOnly && !quick) {
    run("development browsers", ["run", "test:e2e", "--", "--workers=2"]);
    run("production browsers", ["run", "test:e2e", "--", "--workers=2"], {
      PLAYWRIGHT_PRODUCTION: "1",
    });
  }
  if (!quick) {
    run("dependency audit", ["audit", "--audit-level=high"]);
    run("production dependency audit", [
      "audit",
      "--omit=dev",
      "--audit-level=high",
    ]);
  }
  passed = true;
  process.stdout.write(
    quick
      ? "\nQuick checks passed. Build, database, browser and dependency-audit checks were not run. Full verification remains required before pushing.\n"
      : codeOnly
        ? "\nAll code verification checks passed. Browser suites were not run.\n"
        : "\nAll verification checks passed.\n",
  );
} catch (error) {
  process.stderr.write(
    `\n${error.message}\nVerification files and reports: ${snapshot}\n`,
  );
  process.exitCode = 1;
} finally {
  if (passed) rmSync(snapshot, { recursive: true, force: true });
}
