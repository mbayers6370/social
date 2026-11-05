import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deleteClerkIdentity } from "@/server/account/erasure-provider";
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it.each([200, 404])(
  "accepts confirmed deletion or already absent identity (%s)",
  async (status) => {
    fetcher.mockResolvedValue(new Response(null, { status }));
    await deleteClerkIdentity("user_verified");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.clerk.com/v1/users/user_verified",
      expect.objectContaining({ method: "DELETE", redirect: "error" }),
    );
  },
);
it.each([401, 403, 429, 500])(
  "does not mistake provider failure %s for completed erasure",
  async (status) => {
    fetcher.mockResolvedValue(
      new Response("PRIVATE_PROVIDER_CANARY", { status }),
    );
    await expect(deleteClerkIdentity("user_verified")).rejects.toThrow(
      "Provider erasure needs retry",
    );
  },
);
