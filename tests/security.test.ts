// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeEvent } from "@/lib/monitoring/sanitize";
import { paginationSchema } from "@/lib/validation";
import { assertOwner, ForbiddenError } from "@/server/security/authorization";
import { createContentSecurityPolicy } from "@/server/security/csp";
import { getRedisEnv } from "@/server/env";

afterEach(() => vi.unstubAllEnvs());

describe("security boundaries", () => {
  it("isolates infrastructure configuration instead of requiring unrelated service secrets", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect(getRedisEnv()).toEqual({
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    });
  });
  it("discards user identity, request data, breadcrumbs, and arbitrary error text", () => {
    const result = sanitizeEvent({
      type: undefined,
      event_id: "test",
      user: { email: "private@example.com", ip_address: "127.0.0.1" },
      request: {
        url: "https://example.com/?token=secret",
        headers: { Authorization: "Bearer secret" },
        data: "private",
      },
      extra: { password: "secret" },
      contexts: { custom: { token: "secret" } },
      breadcrumbs: [{ message: "secret" }],
      message: "private@example.com secret",
      exception: {
        values: [
          {
            type: "Error",
            value: "secret private@example.com",
            stacktrace: {
              frames: [
                {
                  filename: "app.js?token=secret",
                  lineno: 8,
                  vars: { password: "secret" },
                  pre_context: ["secret"],
                },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret|private@example.com|127\.0\.0\.1/,
    );
    expect(result.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
      filename: "app.js",
      lineno: 8,
      colno: undefined,
      in_app: undefined,
    });
    expect(result.event_id).toBe("test");
  });

  it("does not leak custom exception names, functions, or private source filenames", () => {
    const result = sanitizeEvent({
      type: undefined,
      exception: {
        values: [
          {
            type: "private-message-identifier",
            value: "private-message-body",
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://example.com/private-photograph.js?token=private-token",
                  function: "private-customer-name",
                  lineno: 42,
                },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(result.exception?.values?.[0]).toMatchObject({
      type: "Error",
      value: "[filtered]",
      stacktrace: { frames: [{ filename: "source", lineno: 42 }] },
    });
  });

  it("rejects unauthorized ownership, including empty identities", () => {
    expect(() => assertOwner("viewer", "owner")).toThrow(ForbiddenError);
    expect(() => assertOwner("", "")).toThrow(ForbiddenError);
    expect(() => assertOwner("owner", "owner")).not.toThrow();
  });

  it("bounds untrusted pagination and rejects extra fields", () => {
    expect(paginationSchema.parse({ take: "10" }).take).toBe(10);
    for (const input of [
      { take: 101 },
      { take: -1 },
      { take: "infinity" },
      { userId: "other" },
      { cursor: "invalid" },
    ]) {
      expect(paginationSchema.safeParse(input).success).toBe(false);
    }
  });

  it("requires a nonce and excludes unsafe production script permissions", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const csp = createContentSecurityPolicy("nonce123", false);
    expect(csp).toContain("'nonce-nonce123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("media-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(() => createContentSecurityPolicy("'; injected", false)).toThrow();
  });

  it("fails closed on invalid configuration without exposing the supplied secret", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "secret-value");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(() => getRedisEnv()).toThrow(/UPSTASH_REDIS_REST_URL/);
    expect(() => getRedisEnv()).not.toThrow(/secret-value/);
  });
});
