// @vitest-environment node
// Boundary tests use mocked providers; actual DAL isolation is tested separately in PostgreSQL.
import { afterEach, expect, it, vi } from "vitest";
import { boundedBody, socialRequest } from "@/server/social/http";
import { UnauthorizedError, requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit } from "@/server/security/rate-limit";
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("@/server/auth")>()),
  requireViewer: vi.fn(),
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("keeps the candidate backend disabled by default without opening a database", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "");
  const response = await socialRequest(
    new Request("http://localhost:3000/api/account"),
    "account",
  );
  expect(response.status).toBe(503);
  expect(getDb).not.toHaveBeenCalled();
  expect(requireViewer).not.toHaveBeenCalled();
});
it("rejects anonymous identity despite forged preview or user headers", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.mocked(requireViewer).mockRejectedValueOnce(new UnauthorizedError());
  const response = await socialRequest(
    new Request("http://localhost:3000/api/posts/x", {
      headers: { "x-user-id": "owner", "x-margin-preview": "1" },
    }),
    "readPost",
    "x",
  );
  expect(response.status).toBe(401);
  expect(getDb).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
});
it("denies absent/cross-site origins using the configured origin rather than Host", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.example");
  vi.mocked(requireViewer).mockResolvedValue({ id: "verified-subject" });
  const origins: Record<string, string>[] = [
    { host: "evil.invalid" },
    { origin: "https://evil.invalid", host: "margin.example" },
    { origin: "https://margin.example", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of origins) {
    const response = await socialRequest(
      new Request("https://evil.invalid/api/posts", {
        method: "POST",
        headers,
      }),
      "createPost",
    );
    expect(response.status).toBe(403);
  }
  expect(getDb).not.toHaveBeenCalled();
  expect(enforceRateLimit).not.toHaveBeenCalled();
});
it("sanitizes provider failures and fails closed before database access", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.mocked(requireViewer).mockRejectedValueOnce(
    new Error("PRIVATE_TOKEN_CANARY"),
  );
  const response = await socialRequest(
    new Request("http://localhost:3000/api/account"),
    "account",
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("CANARY");
  expect(getDb).not.toHaveBeenCalled();
});
it("bounds the actual body stream even when Content-Length is absent or misleading", async () => {
  const stream = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(5));
        controller.close();
      },
    });
  for (const headers of [{}, { "content-length": "1" }]) {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers,
      body: stream(),
      duplex: "half",
    } as RequestInit);
    await expect(boundedBody(request, 8)).rejects.toMatchObject({
      status: 413,
    });
  }
});
