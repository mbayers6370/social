import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { waitlistRequest } from "@/server/waitlist";
import { RateLimitError } from "@/server/security/rate-limit";

const { createMany, limit } = vi.hoisted(() => ({
  createMany: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  getDb: () => ({ waitlistEntry: { createMany } }),
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: limit,
}));
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.social");
  createMany.mockReset().mockResolvedValue({ count: 1 });
  limit.mockReset().mockResolvedValue(undefined);
});
const request = (data: unknown, origin = "https://margin.social") =>
  new Request("https://margin.social/api/waitlist", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
it("records only canonical email and consent, returning the same response for duplicates", async () => {
  const first = await waitlistRequest(
    request({ email: " Person@Example.com ", consent: true }),
  );
  createMany.mockResolvedValue({ count: 0 });
  const duplicate = await waitlistRequest(
    request({ email: "person@example.com", consent: true }),
  );
  expect(first.status).toBe(202);
  expect(duplicate.status).toBe(202);
  expect(await first.json()).toEqual(await duplicate.json());
  expect(first.headers.get("cache-control")).toBe("private, no-store");
  expect(createMany).toHaveBeenCalledWith({
    data: [
      { email: "person@example.com", consentVersion: "invitation-news-v1" },
    ],
    skipDuplicates: true,
  });
  const addressKey = limit.mock.calls.find(
    ([policy]) => policy === "waitlistAddress",
  )![1];
  expect(addressKey).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(limit.mock.calls)).not.toContain("person@example.com");
});
it("rejects cross-origin, invalid email and missing consent without saving", async () => {
  expect(
    (
      await waitlistRequest(
        request(
          { email: "person@example.com", consent: true },
          "https://other.invalid",
        ),
      )
    ).status,
  ).toBe(403);
  for (const data of [
    { email: "bad", consent: true },
    { email: "person@example.com" },
    { email: "person@example.com", consent: false },
    { email: "person@example.com", consent: true, role: "FOUNDER" },
  ])
    expect((await waitlistRequest(request(data))).status).toBe(400);
  expect(createMany).not.toHaveBeenCalled();
});
it("fails closed on limiter or database outages and returns retry instructions", async () => {
  limit.mockRejectedValueOnce(new RateLimitError(30));
  const limited = await waitlistRequest(
    request({ email: "person@example.com", consent: true }),
  );
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("30");
  expect(createMany).not.toHaveBeenCalled();
  createMany.mockRejectedValue(new Error("database secret detail"));
  const unavailable = await waitlistRequest(
    request({ email: "person@example.com", consent: true }),
  );
  expect(unavailable.status).toBe(503);
  expect(await unavailable.text()).not.toContain("secret");
});
