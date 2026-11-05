import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isLocalReviewConfiguration } from "@/lib/local-review";
import { isPublicPage, isPublicAsset } from "@/lib/public-routes";

export const EDGE_TOKEN_HEADER = "x-margin-edge-token";
export const EDGE_COUNTRY_HEADER = "x-margin-country";

export function geofenceRequired() {
  return (
    process.env.NODE_ENV === "production" &&
    !isLocalReviewConfiguration(process.env)
  );
}

/** Only public information and exact public assets bypass the product restriction. */
export function isRegionRestrictedPath(path: string) {
  if (path === "/sign-in" || path === "/sign-up") return true;
  return !(
    path === "/" ||
    isPublicPage(path) ||
    isPublicAsset(path) ||
    path === "/api/health" ||
    path === "/api/webhooks/clerk" ||
    path.startsWith("/_next/static/") ||
    path === "/_next/image"
  );
}

export function regionAccess(
  headers: Headers,
): "allowed" | "denied" | "unconfigured" {
  if (!geofenceRequired()) return "allowed";
  const secret = process.env.MARGIN_EDGE_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(secret)) return "unconfigured";
  const supplied = headers.get(EDGE_TOKEN_HEADER) ?? "";
  if (
    supplied.length > 128 ||
    !timingSafeEqual(
      createHash("sha256").update(secret).digest(),
      createHash("sha256").update(supplied).digest(),
    )
  )
    return "denied";
  // Never trust CF-IPCountry, forwarded IPs, browser locale or submitted profile fields.
  return headers.get(EDGE_COUNTRY_HEADER) === "US" ? "allowed" : "denied";
}

export function regionUnavailable(
  request: Request,
  access: "denied" | "unconfigured",
) {
  const status = access === "unconfigured" ? 503 : 403;
  const message =
    access === "unconfigured"
      ? "Account access is temporarily unavailable. Please try again later."
      : "Margin is currently available only from the United States. If your connection was identified incorrectly, contact support@margin.social.";
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, noarchive, nosnippet",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Cookie, Authorization",
  };
  if (new URL(request.url).pathname.startsWith("/api/"))
    return NextResponse.json(
      { error: message, code: "REGION_UNAVAILABLE" },
      { status, headers },
    );
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account access · Margin</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#F2F0EA;color:#30383D;font:1rem/1.6 system-ui,sans-serif}main{max-width:30rem;margin:24px;padding:32px;border:1px solid #C9CBA5;border-radius:14px;background:#FCFBFA}h1{font:500 1.75rem/1.2 Georgia,serif;color:#454D24}a{display:inline-flex;align-items:center;min-height:44px;margin-right:20px;color:#454D24}a:focus-visible{outline:2px solid #454D24;outline-offset:3px}</style><main><h1>${status === 403 ? "Margin isn’t available from this connection." : "Account access is unavailable."}</h1><p>${message}</p><a href="/contact">Contact support</a><a href="/your-data">Your data</a><a href="/privacy">Privacy</a></main></html>`,
    {
      status,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      },
    },
  );
}
