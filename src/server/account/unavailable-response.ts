import "server-only";
import { NextResponse } from "next/server";
export function authenticationUnavailable(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, noarchive, nosnippet",
    "Retry-After": "30",
    "X-Content-Type-Options": "nosniff",
  };
  if (!request.headers.get("accept")?.includes("text/html"))
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503, headers },
    );
  // Static, dependency-free fallback: no provider error, request URL or identity is reflected.
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account access unavailable · margin</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#FAF9F6;color:#30383D;font:1rem/1.6 system-ui,sans-serif}main{max-width:26rem;margin:24px;padding:32px;border:1px solid #DADAD8;border-radius:14px;background:#FCFBFA}h1{font:2rem/1.2 Georgia,serif;color:#454D24}a{display:inline-flex;align-items:center;min-height:44px;margin-right:24px;color:#454D24}a:focus-visible{outline:2px solid #454D24;outline-offset:3px}</style><main><p>margin</p><h1>Account access is unavailable.</h1><p>We couldn’t verify your session. Please try again in a moment.</p><a href="/sign-in">Return to sign in</a><a href="/welcome">Return to Margin</a></main></html>`,
    {
      status: 503,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
