import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const boundary = vi.hoisted(() => ({ verify: vi.fn(), queue: vi.fn() }));
vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: boundary.verify }));
vi.mock("@/server/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/account/erasure", () => ({
  AccountErasureService: class {
    request = boundary.queue;
  },
}));
import { POST } from "@/app/api/webhooks/clerk/route";
beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_fixture");
  boundary.verify.mockResolvedValue({
    type: "user.deleted",
    data: { id: "deleted-identity" },
  });
  boundary.queue.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const request = () =>
  new NextRequest("https://margin.example/api/webhooks/clerk", {
    method: "POST",
    body: JSON.stringify({ type: "user.deleted", data: { id: "forged-body" } }),
  });
it("queues only the officially verified deleted identity and safely accepts duplicate delivery", async () => {
  expect((await POST(request())).status).toBe(204);
  expect((await POST(request())).status).toBe(204);
  expect(boundary.queue).toHaveBeenCalledWith("deleted-identity", true);
  expect(boundary.queue).not.toHaveBeenCalledWith("forged-body", true);
});
it("rejects unsigned/unconfigured/oversized input and retries uncommitted erasure intents", async () => {
  boundary.verify.mockRejectedValueOnce(Error("bad signature"));
  expect((await POST(request())).status).toBe(400);
  expect(boundary.queue).not.toHaveBeenCalled();
  const oversized = new NextRequest(
    "https://margin.example/api/webhooks/clerk",
    { method: "POST", body: "x".repeat(65_537) },
  );
  expect((await POST(oversized)).status).toBe(400);
  boundary.queue.mockRejectedValueOnce(Error("PRIVATE_DATABASE_CANARY"));
  const failure = await POST(request());
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("CANARY");
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
  expect((await POST(request())).status).toBe(503);
});
