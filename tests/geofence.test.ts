import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  geofenceRequired,
  isRegionRestrictedPath,
  regionAccess,
  regionUnavailable,
} from "@/server/security/geofence";

const secret = "geofence-unit-only-".padEnd(43, "x");
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARGIN_EDGE_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
it("denies forged country headers and direct-origin requests, including a correct country without the origin credential", () => {
  const cases: Record<string, string>[] = [
    {},
    { "CF-IPCountry": "US" },
    { "x-margin-country": "US" },
    { "x-margin-country": "US", "x-margin-edge-token": "wrong" },
  ];
  for (const headers of cases)
    expect(regionAccess(new Headers(headers))).toBe("denied");
});
it.each(["CA", "GB", "XX", "T1", "", "us", "US,CA"])(
  "denies trusted but non-US or unknown country %s",
  (country) => {
    expect(
      regionAccess(
        new Headers({
          "x-margin-country": country,
          "x-margin-edge-token": secret,
        }),
      ),
    ).toBe("denied");
  },
);
it("allows only the trusted US country signal and fails closed on absent or weak production configuration", () => {
  expect(
    regionAccess(
      new Headers({ "x-margin-country": "US", "x-margin-edge-token": secret }),
    ),
  ).toBe("allowed");
  for (const key of ["", "short", " ".repeat(43)]) {
    vi.stubEnv("MARGIN_EDGE_SECRET", key);
    expect(regionAccess(new Headers())).toBe("unconfigured");
  }
});
it("does not allow a local-review flag alone to bypass a hosted production gate", () => {
  vi.stubEnv("MARGIN_LOCAL_REVIEW", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.social");
  expect(geofenceRequired()).toBe(true);
  expect(regionAccess(new Headers())).toBe("denied");
  vi.stubEnv("NODE_ENV", "development");
  expect(regionAccess(new Headers())).toBe("allowed");
});
it("restricts account routes and APIs while preserving exact public information, assets and signed webhook delivery", () => {
  for (const path of [
    "/app",
    "/app/feed",
    "/api/photos/private",
    "/api/account/erasure",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/invite/claim/token",
    "/onboarding",
    "/people/matt",
    "/privacy/export",
    "/api/health/private",
    "/api/webhooks/clerk/private",
  ])
    expect(isRegionRestrictedPath(path), path).toBe(true);
  for (const path of [
    "/",
    "/welcome",
    "/privacy",
    "/terms",
    "/help",
    "/your-data",
    "/contact",
    "/api/health",
    "/api/webhooks/clerk",
    "/brands/itunes-store.svg",
    "/_next/static/chunks/app.js",
  ])
    expect(isRegionRestrictedPath(path), path).toBe(false);
});
it("returns noncacheable API denials and an accessible document with support and data-request links", async () => {
  const api = regionUnavailable(
    new Request("https://margin.social/api/member/export"),
    "denied",
  );
  expect(api.status).toBe(403);
  expect(await api.json()).toMatchObject({ code: "REGION_UNAVAILABLE" });
  expect(api.headers.get("Cache-Control")).toBe("private, no-store");
  const page = regionUnavailable(
    new Request("https://margin.social/app"),
    "unconfigured",
  );
  expect(page.status).toBe(503);
  expect(await page.text()).toContain('href="/your-data"');
  expect(page.headers.get("Content-Security-Policy")).toContain(
    "frame-ancestors 'none'",
  );
});
