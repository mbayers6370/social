// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
const { protect, clerkPolicy, clerkRoutes } = vi.hoisted(() => ({
  protect: vi.fn(),
  clerkPolicy: { strict: false, directives: {} as Record<string, string[]> },
  clerkRoutes: { signInUrl: "", signUpUrl: "" },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (
    handler: (
      auth: { protect: typeof protect },
      request: NextRequest,
    ) => Promise<void>,
    options: {
      contentSecurityPolicy: typeof clerkPolicy;
      signInUrl: string;
      signUpUrl: string;
    },
  ) => {
    Object.assign(clerkPolicy, options.contentSecurityPolicy);
    clerkRoutes.signInUrl = options.signInUrl;
    clerkRoutes.signUpUrl = options.signUpUrl;
    return async (request: NextRequest) => {
      await handler({ protect }, request);
      return NextResponse.next();
    };
  },
}));
import proxy, { config } from "@/proxy";
import { PUBLIC_PAGE_PATHS } from "@/lib/public-routes";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://margin.example");
  vi.stubEnv("MARGIN_EDGE_SECRET", "unit-edge-secret-".padEnd(43, "x"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function request(path: string) {
  const result = await proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: {
        "x-margin-edge-token": "unit-edge-secret-".padEnd(43, "x"),
        "x-margin-country": "US",
      },
    }),
    {} as NextFetchEvent,
  );
  expect(result).toBeInstanceOf(NextResponse);
  return result as NextResponse;
}

it("uses Margin's account pages for server authentication redirects", () => {
  expect(clerkRoutes).toEqual({
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  });
});

it("allows device image previews with Clerk while retaining the strict script and media policy", () => {
  expect(clerkPolicy.strict).toBe(true);
  expect(clerkPolicy.directives["img-src"]).toContain("blob:");
  expect(clerkPolicy.directives["script-src"] ?? []).not.toContain("blob:");
  expect(clerkPolicy.directives["media-src"]).toEqual(["'none'"]);
  expect(clerkPolicy.directives["object-src"]).toEqual(["'none'"]);
});

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

it.each(["/api/private.json", "/people/matt"])(
  "marks protected responses for %s noncacheable and nonindexable with and without Clerk",
  async (path) => {
    vi.stubEnv("NODE_ENV", "production");
    for (const credentials of [false, true]) {
      vi.stubEnv("CLERK_SECRET_KEY", credentials ? "sk_live_fixture" : "");
      vi.stubEnv(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        credentials ? "pk_live_fixture" : "",
      );
      const response = await request(path);
      if (credentials) expect(protect).toHaveBeenCalled();
      else expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Robots-Tag")).toBe(
        "noindex, noarchive, nosnippet",
      );
    }
  },
);

for (const mode of ["development", "production"] as const) {
  it(`allows only the approved brand images without auth credentials in ${mode}`, async () => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    for (const asset of [
      "/brand/margin-email.png",
      "/brands/apple-music.svg",
      "/brands/spotify.svg",
      "/brands/itunes-store.svg",
      "/brands/photo-open-cursor.svg",
    ]) {
      const response = await request(asset);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "object-src 'none'",
      );
    }
    for (const path of [
      "/brand/private.png",
      "/brand/margin-email.png/extra",
      "/brand/margin-email.png.bak",
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
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_fixture");
    await request("/brand/margin-email.png");
    await request("/brands/apple-music.svg");
    await request("/brands/spotify.svg");
    expect(protect).not.toHaveBeenCalled();
    await request("/api/private");
    expect(protect).toHaveBeenCalledOnce();
    await request("/brands/private.svg");
    expect(protect).toHaveBeenCalledTimes(2);
    await request("/brand/margin-email.png/extra");
    expect(protect).toHaveBeenCalledTimes(3);
    await request("/brand/private.png");
    expect(protect).toHaveBeenCalledTimes(4);
  });
}

for (const credentials of [false, true]) {
  it(`serves only exact public content paths and keeps their siblings protected (Clerk: ${credentials})`, async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", credentials ? "sk_live_fixture" : "");
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      credentials ? "pk_live_fixture" : "",
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

it("offers the exact development Spaces preview without opening the private APIs", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  expect(
    (await request("/preview/spaces")).headers.get("x-middleware-next"),
  ).toBe("1");
  const redirect = await request("/app/spaces");
  expect(redirect.status).toBe(307);
  expect(redirect.headers.get("location")).toBe(
    "http://localhost:3000/preview/spaces",
  );
  for (const path of [
    "/preview/spaces/private",
    "/preview/spaces.json",
    "/api/spaces",
    "/api/spaces/example/posts",
    "/api/photos/example",
  ])
    expect((await request(path)).status).toBe(503);
});
for (const credentials of [false, true])
  it(`hides the Spaces preview in production (Clerk: ${credentials})`, async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", credentials ? "sk_live_fixture" : "");
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      credentials ? "pk_live_fixture" : "",
    );
    expect((await request("/preview/spaces")).status).toBe(404);
    expect((await request("/app/spaces")).headers.get("location")).toBeNull();
  });

it("fails closed with a readable unavailable page when Clerk fails during route protection", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_fixture");
  protect.mockRejectedValueOnce(Error("PRIVATE_PROVIDER_CANARY"));
  const response = await proxy(
    new NextRequest("https://margin.example/app", {
      headers: {
        accept: "text/html",
        "x-margin-edge-token": "unit-edge-secret-".padEnd(43, "x"),
        "x-margin-country": "US",
      },
    }),
    {} as NextFetchEvent,
  );
  expect(response?.status).toBe(503);
  expect(await response!.text()).toContain("Account access is unavailable");
  expect(response!.headers.get("Cache-Control")).toBe("private, no-store");
});
it("keeps the independently verified session probe out of Clerk page redirects", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_fixture");
  const response = await request("/api/auth/session");
  expect(response.status).toBe(200);
  expect(protect).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("never exposes the authentication fixture in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await request("/preview/auth")).status).toBe(404);
  expect((await request("/preview/onboarding")).status).toBe(404);
});

it("allows the exact onboarding preview only during development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  expect(
    (await request("/preview/onboarding")).headers.get("x-middleware-next"),
  ).toBe("1");
  expect((await request("/preview/onboarding/private")).status).toBe(503);
});

it("serves the localhost production shell without upgrading its HTTP assets", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  const response = await request("/welcome");
  expect(response.headers.get("Content-Security-Policy")).not.toContain(
    "upgrade-insecure-requests",
  );
  expect(response.headers.get("Content-Security-Policy")).toContain(
    "'strict-dynamic'",
  );
});
