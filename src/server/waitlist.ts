import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "./db";
import { enforceRateLimit, RateLimitError } from "./security/rate-limit";
import { json, mutationOrigin, privateHeaders } from "./social/http";
import { SocialError } from "./social/errors";

const input = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  consent: z.literal(true),
});

/** No public reads. Unique canonical addresses make concurrent retries idempotent. */
export async function saveWaitlistEntry(db: PrismaClient, email: string) {
  const normalized = input.parse({ email, consent: true }).email;
  await db.waitlistEntry.createMany({
    data: [{ email: normalized, consentVersion: "invitation-news-v1" }],
    skipDuplicates: true,
  });
}

export async function waitlistRequest(request: Request) {
  try {
    mutationOrigin(request);
    if (new URL(request.url).search)
      throw new SocialError(400, "Unexpected query parameters");
    await enforceRateLimit("waitlistGlobal", "all");
    const data = input.parse(await json(request));
    await enforceRateLimit(
      "waitlistAddress",
      createHash("sha256").update(data.email).digest("hex"),
    );
    await saveWaitlistEntry(getDb(), data.email);
    // Same result for new and existing addresses; no membership/email lookup.
    return Response.json(
      { saved: true },
      { status: 202, headers: privateHeaders },
    );
  } catch (error) {
    const status =
      error instanceof SocialError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : error instanceof RateLimitError
            ? 429
            : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "Enter a valid email address and join for invitation news."
            : status === 429
              ? "Too many requests. Please try again later."
              : status === 503
                ? "We couldn’t save your email. Please try again in a moment."
                : "Request not allowed.",
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
