import "server-only";
import { z } from "zod";
import { requireViewer, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import { reportSchema } from "@/features/safety/model";
import { privatePhotoStore } from "./photo";
import { SocialService } from "./service";
import { SocialError } from "./errors";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Authorization",
};
const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const postSchema = z
  .object({ body: z.string().trim().min(1).max(2000) })
  .strict();
const relationshipSchema = z
  .object({
    targetId: idSchema,
    action: z.enum(["request", "accept", "remove", "block", "unblock"]),
  })
  .strict();
const descriptionSchema = z.string().trim().min(1).max(500);

export async function boundedBody(request: Request, max: number) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > max))
    throw new SocialError(413, "Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new SocialError(400, "Body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new SocialError(413, "Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function json(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new SocialError(415, "JSON required");
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await boundedBody(request, 16_384),
      ),
    ) as unknown;
  } catch (error) {
    if (error instanceof SocialError) throw error;
    throw new SocialError(400, "Invalid JSON");
  }
}
function mutationOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  // Compare to configured origin, never a client-controlled Host/forwarded header.
  if (
    !configured ||
    request.headers.get("origin") !== new URL(configured).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new SocialError(403, "Request not allowed");
}
export type SocialOperation =
  | "report"
  | "createInvitation"
  | "account"
  | "deactivate"
  | "relationship"
  | "createPost"
  | "createPhotoPost"
  | "readPost"
  | "readPhoto"
  | "deletePost"
  | "deletePhoto";
/** Shared HTTP boundary. No test header, submitted actor ID, permissive CORS, or public cache. */
export async function socialRequest(
  request: Request,
  operation: SocialOperation,
  resourceId?: string,
) {
  try {
    if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1")
      throw new SocialError(503, "Private backend is not enabled");
    const { id: subject } = await requireViewer();
    if (new URL(request.url).search)
      throw new SocialError(400, "Unexpected query parameters");
    const mutation = !["account", "readPost", "readPhoto"].includes(operation);
    if (mutation) mutationOrigin(request);
    // Applies to reads too: avoid unrestricted object-store/DB amplification.
    await enforceRateLimit("mutation", subject);
    const service = new SocialService(getDb(), privatePhotoStore);
    const id =
      resourceId === undefined ? undefined : idSchema.parse(resourceId);
    let result: unknown;
    switch (operation) {
      case "report":
        result = await service.createReport(
          subject,
          reportSchema.parse(await json(request)),
        );
        break;
      case "createInvitation":
        result = await service.createInvitation(subject);
        break;
      case "account":
        result = await service.account(subject);
        break;
      case "deactivate":
        await service.deactivate(subject);
        break;
      case "relationship": {
        const input = relationshipSchema.parse(await json(request));
        await service.relationship(subject, input.targetId, input.action);
        break;
      }
      case "createPost":
        result = await service.createPost(
          subject,
          postSchema.parse(await json(request)).body,
        );
        break;
      case "createPhotoPost": {
        const type = request.headers.get("content-type") ?? "";
        const description = descriptionSchema.parse(
          request.headers.get("x-photo-description"),
        );
        // Active-account check before accepting a large body; rechecked inside the transaction.
        if ((await service.account(subject))?.accountStatus !== "ACTIVE")
          throw new SocialError(403, "Account is not active");
        result = await service.createPhotoPost(
          subject,
          await boundedBody(request, PHOTO_MAX_BYTES),
          type,
          description,
        );
        break;
      }
      case "readPost":
        result = await service.readPost(subject, id!);
        break;
      case "readPhoto": {
        const bytes = await service.readPhoto(subject, id!);
        return new Response(new Uint8Array(bytes), {
          headers: {
            ...privateHeaders,
            "Content-Type": "image/webp",
            "Content-Disposition": 'inline; filename="photograph.webp"',
            "Content-Length": String(bytes.length),
          },
        });
      }
      case "deletePost":
        await service.deletePost(subject, id!);
        break;
      case "deletePhoto":
        await service.deletePhoto(subject, id!);
        break;
    }
    return result === undefined
      ? new Response(null, { status: 204, headers: privateHeaders })
      : Response.json(result, {
          headers: privateHeaders,
          status: operation.startsWith("create") ? 201 : 200,
        });
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
    const message =
      error instanceof SocialError
        ? error.message
        : status === 401
          ? "Authentication required"
          : status === 429
            ? "Too many requests"
            : status === 400
              ? "Invalid request"
              : "Service unavailable";
    // No request body, SQL, storage key, provider exception, or subject in responses/logs.
    return Response.json(
      { error: message },
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
