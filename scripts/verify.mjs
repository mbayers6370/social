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
import { tmpdir } from "node:os";
import { isolatedEnvironment, localTestPort } from "./testing/environment.mjs";
import { pruneVerificationReports } from "./local-storage-policy.mjs";

const root = process.cwd();
const codeOnly = process.argv.includes("--code-only");
const quick = process.argv.includes("--quick");
const extended = process.argv.includes("--extended");
const testFiles = process.argv
  .slice(2)
  .filter(
    (argument) => !["--code-only", "--quick", "--extended"].includes(argument),
  );
if ([codeOnly, quick, extended].filter(Boolean).length > 1)
  throw new Error("Choose one verification level.");
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
mkdirSync(path.join(root, ".local", "verification"), { recursive: true });
const prunedReports = pruneVerificationReports(root, 2);
if (prunedReports.length)
  process.stdout.write(
    `Removed ${prunedReports.length} expired verification report${prunedReports.length === 1 ? "" : "s"}.\n`,
  );
const report = mkdtempSync(path.join(root, ".local", "verification", "run-"));
const snapshot = mkdtempSync(path.join(tmpdir(), "margin-verify-"));
const removeSnapshot = () => rmSync(snapshot, { recursive: true, force: true });
process.once("exit", removeSnapshot);
const env = isolatedEnvironment(
  process.env,
  readFileSync(path.join(root, ".env.example"), "utf8"),
);
if (!codeOnly && !quick) env.PLAYWRIGHT_PORT = String(await localTestPort());
env.PLAYWRIGHT_EXTENDED = extended ? "1" : "";
env.PLAYWRIGHT_CAPTURE =
  extended && process.env.PLAYWRIGHT_CAPTURE === "1" ? "1" : "";
const phases = [];
const started = performance.now();
const run = (label, args, extra = {}, cwd = snapshot) => {
  process.stdout.write(`\nChecking ${label}…\n`);
  const start = performance.now();
  const result = spawnSync("npm", args, {
    cwd,
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  phases.push({
    phase: label,
    seconds: Number(((performance.now() - start) / 1000).toFixed(2)),
    exitCode: result.status ?? 1,
  });
  if (result.status !== 0)
    throw new Error(
      `${label} failed${result.error ? `: ${result.error.message}` : ""}.`,
    );
};
let passed = false;
try {
  run("local storage", ["run", "local:check"], {}, root);
  // The existing real database gate remains mandatory for full and extended runs.
  if (!codeOnly && !quick)
    run(
      "isolated PostgreSQL",
      ["run", "test:social-db"],
      { MARGIN_TEST_REPORT: path.join(report, "database.json") },
      root,
    );
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
  // Next 16 requires linked dependencies to be an explicit additional root;
  // keeping the snapshot itself as Turbopack's root also keeps build output inside it.
  // Only this disposable config changes; the open development server is untouched.
  const config = path.join(snapshot, "next.config.ts");
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace(
      "const nextConfig: NextConfig = {",
      `const nextConfig: NextConfig = {\n  experimental: {\n    turbopackAdditionalRoots: {\n      dependencies: {\n        path: ${JSON.stringify(root)},\n      },\n    },\n  },`,
    ),
  );
  if (Number(process.versions.node.split(".")[0]) !== 22)
    process.stdout.write(
      `Using Node ${process.versions.node}; CI uses the Node 22 version declared in .nvmrc.\n`,
    );
  for (const script of ["format:check", "typecheck", "lint", "styles:check"])
    run(script, ["run", script]);
  run("unit tests", [
    "run",
    "test",
    "--",
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=${path.join(report, "unit.json")}`,
    ...testFiles,
  ]);
  if (!quick) run("build", ["run", "build"]);
  if (!codeOnly && !quick) {
    run("development browsers", ["run", "test:e2e"]);
    run("production browsers", ["run", "test:e2e"], {
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
  process.stderr.write(`\n${error.message}\nVerification report: ${report}\n`);
  process.exitCode = 1;
} finally {
  const browserReports = path.join(snapshot, "test-reports");
  if (existsSync(browserReports))
    cpSync(browserReports, path.join(report, "browsers"), { recursive: true });
  if (
    env.PLAYWRIGHT_CAPTURE === "1" &&
    existsSync(path.join(snapshot, "test-results"))
  )
    cpSync(path.join(snapshot, "test-results"), path.join(report, "captures"), {
      recursive: true,
    });
  writeFileSync(
    path.join(report, "summary.json"),
    JSON.stringify(
      {
        level: quick
          ? "fast"
          : codeOnly
            ? "code-only"
            : extended
              ? "extended"
              : "full",
        passed,
        seconds: Number(((performance.now() - started) / 1000).toFixed(2)),
        phases,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(`Verification timings and test results: ${report}\n`);
  removeSnapshot();
}
