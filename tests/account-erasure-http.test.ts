import { afterEach, beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  session: vi.fn(),
  auth: vi.fn(),
  rate: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: boundary.auth,
  reverificationErrorResponse: () =>
    Response.json({ reverification: "strict" }, { status: 403 }),
}));
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("@/server/auth")>()),
  requireAccountSession: boundary.session,
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: boundary.rate,
}));
vi.mock("@/server/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/account/erasure", () => ({
  AccountErasureService: class {
    request = boundary.request;
  },
}));
import { requestAccountErasure } from "@/server/account/erasure-http";
import { UnauthorizedError } from "@/server/auth";
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.example");
  boundary.session.mockResolvedValue({ subject: "verified-account" });
  boundary.auth.mockResolvedValue({
    userId: "verified-account",
    has: () => true,
  });
  boundary.request.mockResolvedValue(undefined);
  boundary.rate.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
function request(
  value: unknown = { confirmation: "DELETE" },
  origin = "https://margin.example",
) {
  return new Request("https://margin.example/api/account/erasure", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(value),
  });
}
it("uses only the verified identity, accepts the durable request and never accepts a submitted target account", async () => {
  const accepted = await requestAccountErasure(request());
  expect(accepted.status).toBe(202);
  expect(boundary.request).toHaveBeenCalledWith("verified-account");
  expect(accepted.headers.get("Cache-Control")).toBe("private, no-store");
  boundary.request.mockClear();
  expect(
    (
      await requestAccountErasure(
        request({ confirmation: "DELETE", subject: "victim" }),
      )
    ).status,
  ).toBe(400);
  expect(boundary.request).not.toHaveBeenCalled();
});
it("requires a current verified session, same-origin request, exact confirmation and strict reverification", async () => {
  expect(
    (await requestAccountErasure(request({}, "https://evil.example"))).status,
  ).toBe(403);
  expect(
    (await requestAccountErasure(request({ confirmation: "delete" }))).status,
  ).toBe(400);
  boundary.auth.mockResolvedValue({
    userId: "verified-account",
    has: () => false,
  });
  const response = await requestAccountErasure(request());
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ reverification: "strict" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  boundary.session.mockRejectedValue(new UnauthorizedError());
  expect((await requestAccountErasure(request())).status).toBe(401);
  expect(boundary.request).not.toHaveBeenCalled();
});
it("does not disclose failures or acknowledge a queue write that did not commit", async () => {
  boundary.request.mockRejectedValue(Error("PRIVATE_DATABASE_CANARY"));
  const response = await requestAccountErasure(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_DATABASE_CANARY");
});
