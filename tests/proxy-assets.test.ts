// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
const { protect } = vi.hoisted(() => ({ protect: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (
      handler: (
        auth: { protect: typeof protect },
        request: NextRequest,
      ) => Promise<void>,
    ) =>
    async (request: NextRequest) => {
      await handler({ protect }, request);
      return NextResponse.next();
    },
}));
import proxy, { config } from "@/proxy";
import { PUBLIC_PAGE_PATHS } from "@/lib/public-routes";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function request(path: string) {
  const result = await proxy(
    new NextRequest(`http://localhost:3000${path}`),
    {} as NextFetchEvent,
  );
  expect(result).toBeInstanceOf(NextResponse);
  return result as NextResponse;
}

it("does not exempt private paths that resemble public asset filenames", () => {
  for (const path of [
    "/robots.txt/private",
    "/robotsXtxt",
    "/sitemap.xml/private",
    "/favicon.ico/private",
    "/_next/image/private",
    "/_next/static-private/photo.jpg",
    "/api/private.json",
  ])
    expect(unstable_doesMiddlewareMatch({ config, url: path }), path).toBe(
      true,
    );
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpublic.jpg&w=640&q=75",
    "/_next/static/chunks/public.js",
  ])
    expect(unstable_doesMiddlewareMatch({ config, url: path }), path).toBe(
      false,
    );
});

it("marks protected responses noncacheable and nonindexable with and without Clerk", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const credentials of [false, true]) {
    vi.stubEnv("CLERK_SECRET_KEY", credentials ? "test-secret" : "");
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      credentials ? "test-key" : "",
    );
    const response = await request("/api/private.json");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, noarchive, nosnippet",
    );
  }
});

for (const mode of ["development", "production"] as const) {
  it(`allows only the approved brand images without auth credentials in ${mode}`, async () => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    for (const asset of [
      "/brands/apple-music.svg",
      "/brands/spotify.svg",
      "/brands/itunes-store.svg",
    ]) {
      const response = await request(asset);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "object-src 'none'",
      );
    }
    for (const path of [
      "/brands/private.svg",
      "/brands/apple-music.svg/extra",
      "/brands/spotify.svg.bak",
      "/brands/README.md",
      "/api/private",
      "/feed",
    ]) {
      expect((await request(path)).status).toBe(503);
    }
  });
  it(`keeps Clerk authorization for protected paths while serving brand images in ${mode}`, async () => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("CLERK_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "test-publishable");
    await request("/brands/apple-music.svg");
    await request("/brands/spotify.svg");
    expect(protect).not.toHaveBeenCalled();
    await request("/api/private");
    expect(protect).toHaveBeenCalledOnce();
    await request("/brands/private.svg");
    expect(protect).toHaveBeenCalledTimes(2);
  });
}

for (const credentials of [false, true]) {
  it(`serves only exact public content paths and keeps their siblings protected (Clerk: ${credentials})`, async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", credentials ? "test-secret" : "");
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      credentials ? "test-key" : "",
    );
    for (const path of PUBLIC_PAGE_PATHS)
      expect((await request(path)).status).toBe(200);
    expect(protect).not.toHaveBeenCalled();
    for (const path of [
      "/privacy/private",
      "/your-data/export",
      "/help/admin",
      "/api/account/delete",
    ]) {
      const response = await request(path);
      if (!credentials) expect(response.status).toBe(503);
    }
    if (credentials) expect(protect).toHaveBeenCalledTimes(4);
    else {
      const first = (await request("/privacy")).headers.get(
        "Content-Security-Policy",
      );
      const second = (await request("/privacy")).headers.get(
        "Content-Security-Policy",
      );
      expect(first).toContain("'strict-dynamic'");
      expect(first).not.toBe(second);
    }
  });
}
