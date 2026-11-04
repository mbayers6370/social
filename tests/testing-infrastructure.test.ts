import { expect, it } from "vitest";
import { isolatedEnvironment } from "../scripts/testing/environment.mjs";
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
