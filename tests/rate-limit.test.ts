// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/server/cache", () => ({ getRedis: () => ({}) }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
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
