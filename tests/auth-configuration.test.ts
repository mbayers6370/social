// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountConfiguration } from "@/server/account/config";
import {
  localReviewBuildDirectory,
  nextBuildDirectory,
} from "@/lib/local-review";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.example");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
  vi.stubEnv("MARGIN_REGISTRATION_ENABLED", "");
});
afterEach(() => vi.unstubAllEnvs());
it("keeps registration closed even when authentication is configured", () => {
  expect(accountConfiguration()).toEqual({
    configured: true,
    origin: "https://margin.example",
    registrationEnabled: false,
  });
});
it.each([
  "",
  "http://margin.example",
  "https://user:secret@margin.example",
  "https://margin.example/path",
  "https://margin.example?next=evil",
])("rejects an unsafe/missing production origin: %s", (origin) => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  expect(accountConfiguration().configured).toBe(false);
});
it("rejects mismatched provider keys and test keys in production", () => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  expect(accountConfiguration().configured).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  expect(accountConfiguration().configured).toBe(false);
});
it.each(["https://10.0.0.77:3000", "http://localhost:3000"])(
  "permits test providers for an isolated local production review at %s",
  (origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://margin_runtime:fixture@127.0.0.1:55432/margin_local?schema=public",
    );
    vi.stubEnv("MARGIN_LOCAL_PHOTO_STORE", "1");
    vi.stubEnv("MARGIN_LOCAL_REVIEW", "1");
    vi.stubEnv("CI", "");
    expect(accountConfiguration().configured).toBe(true);
  },
);
it("isolates local review output from the standard Next build", () => {
  expect(nextBuildDirectory({ MARGIN_LOCAL_REVIEW: "1" })).toBe(
    localReviewBuildDirectory,
  );
  expect(nextBuildDirectory({ MARGIN_LOCAL_REVIEW: "" })).toBeUndefined();
});
it.each([
  [
    "remote application origin",
    "NEXT_PUBLIC_APP_URL",
    "https://margin.example",
  ],
  [
    "remote database",
    "DATABASE_URL",
    "postgresql://margin_runtime:fixture@db.example:5432/margin_local",
  ],
  ["CI", "CI", "true"],
  ["insecure LAN origin", "NEXT_PUBLIC_APP_URL", "http://10.0.0.77:3000"],
  [
    "lookalike localhost",
    "NEXT_PUBLIC_APP_URL",
    "http://localhost.example:3000",
  ],
  ["missing explicit flag", "MARGIN_LOCAL_REVIEW", ""],
])("rejects local review with %s", (_case, key, value) => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://10.0.0.77:3000");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://margin_runtime:fixture@127.0.0.1:55432/margin_local?schema=public",
  );
  vi.stubEnv("MARGIN_LOCAL_PHOTO_STORE", "1");
  vi.stubEnv("MARGIN_LOCAL_REVIEW", "1");
  vi.stubEnv("CI", "");
  vi.stubEnv(key, value);
  expect(accountConfiguration().configured).toBe(false);
});
it("allows a separately configured local development instance without enabling registration", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  expect(accountConfiguration()).toEqual({
    configured: true,
    origin: "http://localhost:3000",
    registrationEnabled: false,
  });
});
