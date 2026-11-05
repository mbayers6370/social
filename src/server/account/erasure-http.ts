import "server-only";
import { auth, reverificationErrorResponse } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireAccountSession, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { privatePhotoStore } from "@/server/social/photo";
import { json, mutationOrigin, privateHeaders } from "@/server/social/http";
import { SocialError } from "@/server/social/errors";
import { AccountErasureService } from "./erasure";

export async function requestAccountErasure(request: Request) {
  try {
    if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1")
      throw new SocialError(503, "Account services are unavailable.");
    const session = await requireAccountSession({ verifiedEmail: false });
    mutationOrigin(request);
    if (new URL(request.url).search)
      throw new SocialError(400, "Unexpected query parameters");
    await enforceRateLimit("mutation", session.subject);
    z.strictObject({ confirmation: z.literal("DELETE") }).parse(
      await json(request),
    );
    const identity = await auth();
    if (identity.userId !== session.subject) throw new UnauthorizedError();
    if (!identity.has({ reverification: "strict" })) {
      const response = reverificationErrorResponse("strict");
      for (const [key, value] of Object.entries(privateHeaders))
        response.headers.set(key, value);
      return response;
    }
    await new AccountErasureService(getDb(), privatePhotoStore).request(
      session.subject,
    );
    return Response.json(
      { accepted: true },
      { status: 202, headers: privateHeaders },
    );
  } catch (error) {
    const status =
      error instanceof SocialError
        ? error.status
        : error instanceof UnauthorizedError
          ? 401
          : error instanceof RateLimitError
            ? 429
            : error instanceof z.ZodError
              ? 400
              : 503;
    return Response.json(
      {
        error:
          error instanceof SocialError
            ? error.message
            : status === 400
              ? "Type DELETE to confirm account deletion."
              : status === 401
                ? "Sign in to request account deletion."
                : status === 429
                  ? "Too many requests. Please try again later."
                  : "Account deletion could not be confirmed. Please retry or contact support@margin.social.",
      },
      {
        status,
        headers: {
          ...privateHeaders,
          ...(error instanceof RateLimitError
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
