// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { limit, configure, slidingWindow } = vi.hoisted(() => ({
  limit: vi.fn(),
  configure: vi.fn(),
  slidingWindow: vi.fn(() => ({})),
}));
vi.mock("@/server/cache", () => ({ getRedis: () => ({}) }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = slidingWindow;
    constructor(options: object) {
      configure(options);
    }
    limit = limit;
  },
}));
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";

describe("rate limiting", () => {
  it("rejects denied requests and reports a retry delay", async () => {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 5000 });
    await expect(
      enforceRateLimit("mutation", "verified-user"),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(limit).toHaveBeenCalledWith("verified-user");
  });
  it("propagates Redis failures instead of allowing the mutation", async () => {
    limit.mockRejectedValue(new Error("Redis unavailable"));
    await expect(enforceRateLimit("mutation", "verified-user")).rejects.toThrow(
      "Redis unavailable",
    );
  });
  it("rejects an empty subject", async () => {
    await expect(enforceRateLimit("mutation", "")).rejects.toThrow("subject");
    expect(limit).not.toHaveBeenCalled();
  });
});

describe("authentication abuse policies", () => {
  it.each([
    ["authSession", 120],
    ["onboarding", 5],
  ] as const)(
    "uses the shared, non-analytic Redis gate for %s",
    async (policy, requests) => {
      limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
      await enforceRateLimit(policy, "verified-user");
      expect(slidingWindow).toHaveBeenCalledWith(requests, "1 m");
      expect(configure).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: `social:ratelimit:${policy}`,
          analytics: false,
        }),
      );
    },
  );
  it("denies authentication requests when their budget or Redis is unavailable", async () => {
    limit.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 });
    await expect(
      enforceRateLimit("authSession", "verified-user"),
    ).rejects.toBeInstanceOf(RateLimitError);
    limit.mockRejectedValueOnce(Error("Redis unavailable"));
    await expect(
      enforceRateLimit("onboarding", "verified-user"),
    ).rejects.toThrow("Redis unavailable");
  });
  it("rejects the SDK's permissive timeout response instead of granting authentication", async () => {
    limit.mockResolvedValueOnce({
      success: true,
      reason: "timeout",
      reset: 0,
    });
    await expect(
      enforceRateLimit("authSession", "verified-user"),
    ).rejects.toThrow("Rate-limit service unavailable");
  });
});
