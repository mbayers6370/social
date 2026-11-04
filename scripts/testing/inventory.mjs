import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isolatedEnvironment } from "./environment.mjs";

const root = process.cwd();
const output = path.join(root, ".local", "test-inventory");
mkdirSync(output, { recursive: true });
const env = isolatedEnvironment(
  process.env,
  readFileSync(".env.example", "utf8"),
);
function collect(binary, args, file, extra = {}) {
  const result = spawnSync(process.execPath, [binary, ...args], {
    cwd: root,
    env: { ...env, ...extra },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`Test collection failed: ${file}\n${result.stderr}`);
  const data = JSON.parse(result.stdout);
  writeFileSync(path.join(output, file), JSON.stringify(data, null, 2) + "\n");
  return data;
}
// Collection executes declarations, not test bodies or lifecycle hooks.
const tests = collect(
  "node_modules/vitest/vitest.mjs",
  ["list", "--json"],
  "vitest.json",
  {
    RUN_PRIVATE_DB_TESTS: "1",
    RUN_LOCAL_DB_TESTS: "1",
    RUN_LIVE_AUTH_TESTS: "1",
    RUN_LIVE_MUSIC_TEST: "1",
  },
);
function browserRows(suites) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => ({
        file: spec.file,
        name: spec.title,
        project: test.projectName,
      })),
    ),
    ...browserRows(suite.suites ?? []),
  ]);
}
const matrix = {};
for (const [level, extra] of Object.entries({
  full: {},
  production: { PLAYWRIGHT_PRODUCTION: "1" },
  extended: { PLAYWRIGHT_EXTENDED: "1" },
})) {
  const data = collect(
    "node_modules/playwright/cli.js",
    ["test", "--list", "--reporter=json"],
    `playwright-${level}.json`,
    extra,
  );
  matrix[level] = browserRows(data.suites);
}
const files = {};
for (const test of tests) {
  const file = path.relative(root, test.file);
  const category = /(?:redis-live|music-db)\.integration/.test(file)
    ? "opt-in services"
    : /-db\.integration/.test(file)
      ? "PostgreSQL integration"
      : file.endsWith(".tsx")
        ? "component"
        : "unit and server contracts";
  files[file] ??= { category, tests: 0 };
  files[file].tests++;
}
const categories = {};
for (const file of Object.values(files)) {
  categories[file.category] ??= { files: 0, tests: 0 };
  categories[file.category].files++;
  categories[file.category].tests += file.tests;
}
const summary = {
  categories,
  browserExecutions: Object.fromEntries(
    Object.entries(matrix).map(([key, rows]) => [key, rows.length]),
  ),
  files,
  browserMatrix: matrix,
};
writeFileSync(
  path.join(output, "inventory.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify(
    { categories, browserExecutions: summary.browserExecutions, output },
    null,
    2,
  ) + "\n",
);
