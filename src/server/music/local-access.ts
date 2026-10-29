import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { MusicError } from "./catalogue";
import { getDevelopmentOrigins } from "@/lib/development-hosts";
let changes: number[] = [];
export function limitLocalMusicChanges() {
  const now = Date.now();
  changes = changes.filter((time) => time > now - 60_000);
  if (changes.length >= 30)
    throw new MusicError(
      "Changes are happening quickly. Please try again shortly.",
      429,
    );
  changes.push(now);
}

/** Development fixture access only. Never a replacement for verified production sessions. */
export function localMusicAccess(request: NextRequest) {
  if (process.env.NODE_ENV !== "development")
    return new NextResponse(null, { status: 404 });
  let origin: URL;
  try {
    origin = new URL(
      `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`,
    );
  } catch {
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  }
  if (
    origin.username ||
    origin.password ||
    !["localhost", "127.0.0.1", "[::1]", ...getDevelopmentOrigins()].includes(
      origin.hostname,
    ) ||
    ![null, "same-origin", "none"].includes(
      request.headers.get("sec-fetch-site"),
    ) ||
    (request.headers.has("origin") &&
      request.headers.get("origin") !== origin.origin) ||
    request.headers.get("x-margin-preview") !== "1"
  )
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  return null;
}
export function musicFailure(error: unknown) {
  // Do not serialize infrastructure exceptions, queries, URLs or credentials.
  if (error instanceof MusicError)
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  return NextResponse.json(
    { error: "Music is temporarily unavailable. Please try again." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
