import { afterEach, beforeEach, expect, it, vi } from "vitest";
import worker from "../ops/cloudflare/region-edge.mjs";
import { regionAccess } from "@/server/security/geofence";
const fetcher = vi.fn();
const secret = "edge-worker-fixture-".padEnd(43, "x");
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARGIN_EDGE_SECRET", secret);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(new Response("origin"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it.each(["US", "CA", undefined])(
  "overwrites spoofed headers with the actual Cloudflare country %s and never exposes the secret",
  async (country) => {
    const request = new Request("https://margin.social/app", {
      headers: {
        "x-margin-country": "US",
        "x-margin-edge-token": "attacker",
        "CF-IPCountry": "US",
      },
    });
    Object.defineProperty(request, "cf", { value: { country } });
    fetcher.mockResolvedValue(
      new Response("origin", {
        headers: { "x-margin-edge-token": secret, "x-margin-country": "US" },
      }),
    );
    const response = await worker.fetch(request, {
      MARGIN_EDGE_SECRET: secret,
    });
    const forwarded = fetcher.mock.calls[0][0] as Request;
    expect(forwarded.redirect).toBe("manual");
    expect(regionAccess(forwarded.headers)).toBe(
      country === "US" ? "allowed" : "denied",
    );
    expect(response.headers.has("x-margin-edge-token")).toBe(false);
    expect(response.headers.has("x-margin-country")).toBe(false);
  },
);
it("does not forward requests when edge configuration is missing", async () => {
  expect(
    (await worker.fetch(new Request("https://margin.social/app"), {})).status,
  ).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
