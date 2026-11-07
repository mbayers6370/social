import { accountConfiguration } from "@/server/account/config";
import { authenticationUnavailable } from "@/server/account/unavailable-response";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import {
  isPublicPage,
  isPublicAsset,
  isPublicSubmission,
} from "@/lib/public-routes";
import { createContentSecurityPolicy } from "@/server/security/csp";
import {
  isRegionRestrictedPath,
  regionAccess,
  regionUnavailable,
} from "@/server/security/geofence";

function isPublic(pathname: string) {
  return (
    pathname === "/" ||
    isPublicPage(pathname) ||
    isPublicSubmission(pathname) ||
    pathname === "/api/health" ||
    pathname === "/api/webhooks/clerk" ||
    isPublicAsset(pathname) ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/onboarding" ||
    /^\/invite\/(?:claim\/)?[A-Za-z0-9_-]{43}$/.test(pathname) ||
    /^\/api\/invite\/[A-Za-z0-9_-]{43}$/.test(pathname) ||
    (process.env.NODE_ENV === "development" &&
      [
        "/api/development/music",
        "/api/development/music/selections",
        "/api/development/events",
      ].includes(pathname)) ||
    (process.env.NODE_ENV === "development" &&
      [
        "/design-system",
        "/preview/spaces",
        "/preview/auth",
        "/preview/invitations",
        "/preview/onboarding",
      ].includes(pathname))
  );
}

const clerkProxy = clerkMiddleware(
  async (auth, request) => {
    // The session probe owns its JSON 401 response; it verifies the session again on the server.
    if (
      !isPublic(request.nextUrl.pathname) &&
      request.nextUrl.pathname !== "/api/auth/session"
    )
      await auth.protect();
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    authorizedParties: [
      accountConfiguration().origin ?? "https://unconfigured.invalid",
    ],
    contentSecurityPolicy: {
      strict: true,
      directives: {
        // Device photographs stay in the tab as blob URLs until Publish.
        "img-src": ["blob:"],
        "object-src": ["'none'"],
        "media-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        ...(process.env.NEXT_PUBLIC_SENTRY_DSN
          ? {
              "connect-src": [
                new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin,
              ],
            }
          : {}),
      },
    },
  },
);

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (
    request.nextUrl.pathname.startsWith("/api/development/") &&
    process.env.NODE_ENV !== "development"
  )
    return new NextResponse(null, { status: 404 });
  // The job service has been removed. Retire the old URL instead of routing it through auth.
  if (
    request.nextUrl.pathname === "/api/inngest" ||
    request.nextUrl.pathname.startsWith("/api/inngest/")
  )
    return new NextResponse(null, { status: 404 });
  if (
    [
      "/design-system",
      "/preview/spaces",
      "/preview/auth",
      "/preview/invitations",
      "/preview/onboarding",
    ].includes(request.nextUrl.pathname) &&
    process.env.NODE_ENV !== "development"
  )
    return new NextResponse(null, { status: 404 });
  if (isRegionRestrictedPath(request.nextUrl.pathname)) {
    const access = regionAccess(request.headers);
    if (access !== "allowed") return regionUnavailable(request, access);
  }
  if (accountConfiguration().configured) {
    try {
      const response = await clerkProxy(request, event);
      if (response && request.nextUrl.pathname.startsWith("/invite/")) {
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
      }
      if (
        response &&
        (!isPublic(request.nextUrl.pathname) ||
          ["/sign-in", "/sign-up", "/onboarding"].some(
            (path) =>
              request.nextUrl.pathname === path ||
              request.nextUrl.pathname.startsWith(`${path}/`),
          ))
      ) {
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
      }
      return response;
    } catch {
      return authenticationUnavailable(request);
    }
  }
  // Only the local page redirects to fictional review data. APIs retain their auth boundary.
  if (
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname === "/app/spaces"
  )
    return NextResponse.redirect(new URL("/preview/spaces", request.url));
  // Missing credentials never authorize a protected path. Public UI can still run locally.
  if (!isPublic(request.nextUrl.pathname))
    return authenticationUnavailable(request);
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(16)),
  ).toString("base64");
  const csp = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
    request.nextUrl,
  );
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  if (request.nextUrl.pathname.startsWith("/invite/")) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
  }
  response.headers.set("Content-Security-Policy", csp);
  if (
    ["/sign-in", "/sign-up", "/onboarding"].some(
      (path) =>
        request.nextUrl.pathname === path ||
        request.nextUrl.pathname.startsWith(`${path}/`),
    )
  )
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
