// @vitest-environment node
// Explicit opt-in: real Upstash, randomized fixture counters only, no Clerk calls.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const enabled = process.env.RUN_LIVE_AUTH_TESTS === "1";
describe.skipIf(!enabled)("authentication: real Redis integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("shares the onboarding budget across limiter instances and isolates identities", async () => {
    const subject = `auth-integration-${randomUUID()}`;
    const { getRedis } = await import("@/server/cache");
    const redis = getRedis();
    try {
      expect(await redis.ping()).toBe("PONG");
      const first = await import("@/server/security/rate-limit");
      for (let attempt = 0; attempt < 5; attempt++)
        expect(
          (await first.enforceRateLimit("onboarding", subject)).success,
        ).toBe(true);
      vi.resetModules();
      const second = await import("@/server/security/rate-limit");
      await expect(
        second.enforceRateLimit("onboarding", subject),
      ).rejects.toMatchObject({ name: "RateLimitError" });
      expect(
        (await second.enforceRateLimit("onboarding", `${subject}-other`))
          .success,
      ).toBe(true);
    } catch {
      throw new Error(
        "Real Redis budget/isolation check failed; service details withheld.",
      );
    } finally {
      // Never flush or delete another actor's counters. These keys also have SDK TTLs.
      const prefix = `social:ratelimit:onboarding:${subject}`;
      const keys = await redis.keys(`${prefix}*`).catch(() => [] as string[]);
      if (keys.length && keys.every((key) => key.startsWith(prefix)))
        await redis.del(...keys).catch(() => {});
    }
  }, 30_000);
  it("denies access when the real Redis endpoint rejects its credential", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "invalid-auth-integration-token");
    vi.resetModules();
    const { enforceRateLimit } = await import("@/server/security/rate-limit");
    let denied = false;
    try {
      await enforceRateLimit("onboarding", `auth-invalid-${randomUUID()}`);
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
  }, 30_000);
});
