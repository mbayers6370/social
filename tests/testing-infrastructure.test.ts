import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedEnvironment } from "../scripts/testing/environment.mjs";
import {
  inspectLocalStorage,
  pruneVerificationReports,
} from "../scripts/local-storage-policy.mjs";
import { privateTestDatabaseUrl } from "./helpers/database";

it("removes ambient provider credentials and opt-in flags without changing the caller's environment", () => {
  const original = {
    PATH: "/fixture/bin",
    CI: "true",
    MARGIN_CI_POSTGRES: "1",
    MARGIN_PG_BIN: "/fixture/postgres",
    CLERK_SECRET_KEY: "credential-canary",
    UNEXPECTED_PROVIDER_API_KEY: "credential-canary",
    UPSTASH_REDIS_REST_URL: "https://redis.invalid",
    DATABASE_URL: "postgresql://application.invalid/private",
    RUN_LIVE_AUTH_TESTS: "1",
    RUN_LIVE_MUSIC_TEST: "1",
    RUN_PRIVATE_DB_TESTS: "1",
    PLAYWRIGHT_BASE_URL: "https://production.invalid",
    MARGIN_REGISTRATION_ENABLED: "1",
  };
  const isolated = isolatedEnvironment(
    original,
    "MARGIN_REGISTRATION_ENABLED=\n",
  );
  expect(isolated).toEqual({
    PATH: "/fixture/bin",
    CI: "true",
    MARGIN_CI_POSTGRES: "1",
    MARGIN_PG_BIN: "/fixture/postgres",
    MARGIN_REGISTRATION_ENABLED: "",
  });
  expect(original.RUN_LIVE_AUTH_TESTS).toBe("1");
  expect(JSON.stringify(isolated)).not.toContain("credential-canary");
});

const disposable = `postgresql://margin_runtime:fixture@127.0.0.1:55432/margin_slice_test_${"a".repeat(32)}?schema=public`;
it("admits only the disposable database namespace and restricted runtime identity", () => {
  expect(privateTestDatabaseUrl(disposable).pathname).toMatch(
    /^\/margin_slice_test_/,
  );
  for (const value of [
    "",
    "not-a-url",
    disposable.replace("127.0.0.1", "database.example.com"),
    disposable.replace("55432", "5432"),
    disposable.replace("margin_runtime", "margin_owner"),
    disposable.replace(/margin_slice_test_a+/, "margin_local"),
    disposable.replace("postgresql:", "https:"),
  ])
    expect(() => privateTestDatabaseUrl(value)).toThrow(
      "Disposable runtime database required",
    );
});

it("fails immediately when a unit test forgets its provider transport", async () => {
  await expect(
    fetch("https://external-provider.invalid/secret?token=private"),
  ).rejects.toThrow(
    "Unexpected network request: provide an explicit test transport",
  );
});

it("allows only the bounded local state and generated-artifact layout", () => {
  const root = mkdtempSync(join(tmpdir(), "margin-local-policy-"));
  try {
    for (const directory of [
      ".local/postgres",
      ".local/private-photos",
      ".local/tools",
      ".local/local-review/next",
      ".local/local-review/tls",
      ".local/verification/run-current",
    ])
      mkdirSync(join(root, directory), { recursive: true });
    expect(inspectLocalStorage(root).violations).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects copied repositories and unexpected source workspaces in .local", () => {
  const root = mkdtempSync(join(tmpdir(), "margin-local-policy-"));
  try {
    mkdirSync(join(root, ".local/copied-site/.git"), { recursive: true });
    const violations = inspectLocalStorage(root).violations.join("\n");
    expect(violations).toContain("Unexpected .local entry: copied-site");
    expect(violations).toContain("Nested Git repository or worktree");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("enforces the local storage ceiling", () => {
  const root = mkdtempSync(join(tmpdir(), "margin-local-policy-"));
  try {
    mkdirSync(join(root, ".local/tools"), { recursive: true });
    writeFileSync(join(root, ".local/tools/fixture"), "too large");
    expect(
      inspectLocalStorage(root, { byteLimit: 1 }).violations.join("\n"),
    ).toContain("maximum is 1 KiB");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("retains only the newest bounded verification reports", () => {
  const root = mkdtempSync(join(tmpdir(), "margin-local-policy-"));
  try {
    const verification = join(root, ".local/verification");
    for (const [index, report] of [
      "run-old",
      "run-middle",
      "run-new",
    ].entries()) {
      const directory = join(verification, report);
      mkdirSync(directory, { recursive: true });
      const modified = new Date(Date.UTC(2026, 0, index + 1));
      utimesSync(directory, modified, modified);
    }

    expect(pruneVerificationReports(root, 2)).toEqual(["run-old"]);
    expect(existsSync(join(verification, "run-old"))).toBe(false);
    expect(existsSync(join(verification, "run-middle"))).toBe(true);
    expect(existsSync(join(verification, "run-new"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("cleans generated local artifacts idempotently while preserving local state", () => {
  const root = mkdtempSync(join(tmpdir(), "margin-local-cleanup-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "social-foundation" }),
    );
    for (const directory of [
      ".next",
      ".local/local-review/next",
      ".local/verification/run-old",
      ".local/unexpected-generated",
      ".local/auth-activation",
      ".local/local-review/tls",
      ".local/postgres",
      ".local/private-photos",
      ".local/tools",
    ])
      mkdirSync(join(root, directory), { recursive: true });
    for (const file of [
      ".local/database.json",
      ".local/postgres.log",
      ".local/socket",
    ])
      writeFileSync(join(root, file), "protected");

    const cleanup = join(process.cwd(), "scripts/clean-local-artifacts.mjs");
    const first = spawnSync(process.execPath, [cleanup, "--apply"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(first.status).toBe(0);
    for (const generated of [
      ".next",
      ".local/local-review/next",
      ".local/verification",
      ".local/unexpected-generated",
    ])
      expect(existsSync(join(root, generated))).toBe(false);
    for (const protectedPath of [
      ".local/auth-activation",
      ".local/database.json",
      ".local/local-review/tls",
      ".local/postgres",
      ".local/postgres.log",
      ".local/private-photos",
      ".local/socket",
      ".local/tools",
    ])
      expect(existsSync(join(root, protectedPath))).toBe(true);

    const second = spawnSync(process.execPath, [cleanup, "--apply"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("Removed 0 generated paths");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
