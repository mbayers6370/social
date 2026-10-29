// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: session }));
import { requireViewer, UnauthorizedError } from "@/server/auth";

afterEach(() => vi.resetAllMocks());

describe("verified viewer boundary", () => {
  it("rejects missing sessions", async () => {
    session.mockResolvedValue({ userId: null });
    await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("returns only the verified session subject", async () => {
    session.mockResolvedValue({
      userId: "verified-viewer",
      sessionClaims: { email: "private@example.com" },
    });
    expect(await requireViewer()).toEqual({ id: "verified-viewer" });
  });
});
