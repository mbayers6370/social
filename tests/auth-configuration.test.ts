// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountConfiguration } from "@/server/account/config";
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
