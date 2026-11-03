import {
  requireAccountSession,
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { RateLimitError } from "@/server/security/rate-limit";
import { getDb } from "@/server/db";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Authorization",
};
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (new URL(request.url).search)
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers },
    );
  try {
    const session = await requireAccountSession();
    const owner = await getDb().user.findUnique({
      where: { clerkId: session.subject },
      select: { account: { select: { status: true } } },
    });
    if (owner?.account?.status === "DEACTIVATED")
      return Response.json(
        { error: "Account unavailable" },
        { status: 403, headers },
      );
    return Response.json({ sessionId: session.sessionId }, { headers });
  } catch (error) {
    const status =
      error instanceof EmailVerificationRequiredError
        ? 403
        : error instanceof UnauthorizedError
          ? 401
          : error instanceof RateLimitError
            ? 429
            : 503;
    return Response.json(
      {
        error:
          status === 401
            ? "Session ended"
            : status === 403
              ? "Email verification required"
              : "Account access is temporarily unavailable",
      },
      {
        status,
        headers: {
          ...headers,
          ...(error instanceof RateLimitError
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
