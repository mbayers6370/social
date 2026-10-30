import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { isPublicPage } from "@/lib/public-routes";
import { createContentSecurityPolicy } from "@/server/security/csp";

function isPublic(pathname: string) {
  return (
    pathname === "/" ||
    isPublicPage(pathname) ||
    pathname === "/api/health" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    // Public brand artwork only; other asset paths retain their auth boundary.
    pathname === "/brands/apple-music.svg" ||
    pathname === "/brands/spotify.svg" ||
    pathname === "/brands/itunes-store.svg" ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/onboarding" ||
    pathname === "/fonts/NotoSans-Regular.ttf" ||
    pathname === "/fonts/OFL.txt" ||
    (process.env.NODE_ENV === "development" &&
      ["/api/development/music", "/api/development/music/selections"].includes(
        pathname,
      )) ||
    (process.env.NODE_ENV === "development" && pathname === "/design-system")
  );
}

const clerkProxy = clerkMiddleware(
  async (auth, request) => {
    if (!isPublic(request.nextUrl.pathname)) await auth.protect();
  },
  {
    authorizedParties: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ],
    contentSecurityPolicy: {
      strict: true,
      directives: {
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
    request.nextUrl.pathname === "/design-system" &&
    process.env.NODE_ENV !== "development"
  )
    return new NextResponse(null, { status: 404 });
  if (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  ) {
    const response = await clerkProxy(request, event);
    if (response && !isPublic(request.nextUrl.pathname)) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
    }
    return response;
  }
  // Missing credentials never authorize a protected path. Public UI can still run locally.
  if (!isPublic(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, noarchive, nosnippet",
        },
      },
    );
  }
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(16)),
  ).toString("base64");
  const csp = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
  );
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
