import "server-only";
import { z } from "zod";
import { requireViewer, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import { reportSchema } from "@/features/safety/model";
import { privatePhotoStore } from "./photo";
import { SpaceService } from "@/server/spaces/service";
import {
  spaceInput,
  memberInput,
  commentInput,
  resourceId as spaceResourceId,
  eventJoinInput,
  eventScheduleInput,
} from "@/features/spaces/schema";
import { SocialError } from "./errors";
import { memberPostDraftInput } from "@/features/social/member-schema";
import { eventSearchInput } from "@/features/spaces/event-discovery";

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
export async function json(request: Request) {
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
/** Bounded shared multipart/JSON contract for personal and Space composers. */
export async function postDraftRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] === "application/json")
    return {
      input: memberPostDraftInput.parse(await json(request)),
      files: [],
    };
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new SocialError(415, "JSON or a photograph form is required");
  const bytes = await boundedBody(request, 3 * PHOTO_MAX_BYTES + 16_384);
  let form: FormData;
  try {
    form = await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type")! },
      body: new Uint8Array(bytes),
    }).formData();
  } catch {
    throw new SocialError(400, "Invalid photograph form");
  }
  if (
    [...form.keys()].some((key) => !["input", "photos"].includes(key)) ||
    form.getAll("input").length !== 1
  )
    throw new SocialError(400, "Invalid photograph form");
  const text = form.get("input");
  if (typeof text !== "string" || text.length > 8192)
    throw new SocialError(400, "Invalid post");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SocialError(400, "Invalid post");
  }
  const input = memberPostDraftInput.parse(raw);
  const photos = form.getAll("photos");
  if (!photos.length || photos.length + input.photoIds.length > 3)
    throw new SocialError(400, "Choose up to three photographs");
  const files = [];
  for (let index = 0; index < photos.length; index++) {
    const file = photos[index];
    if (!(file instanceof File) || !file.size || file.size > PHOTO_MAX_BYTES)
      throw new SocialError(400, "Invalid photograph");
    files.push({
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: file.type,
      description: "Photograph",
    });
  }
  return { input, files };
}
export function mutationOrigin(request: Request) {
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
  | "spaceSchedule"
  | "spaceEventOpen"
  | "spaceEvents"
  | "spaceJoin"
  | "spacePosts"
  | "spacePublish"
  | "spaceUpload"
  | "spacePhotos"
  | "spaceFeed"
  | "commentsRead"
  | "commentCreate"
  | "spaceDelete"
  | "spaceList"
  | "spaceCreate"
  | "spaceRead"
  | "spaceUpdate"
  | "spaceInviteCandidates"
  | "spaceInvite"
  | "spaceAccept"
  | "spaceMember"
  | "spaceArchive"
  | "report"
  | "account"
  | "profile"
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
    const query = new URL(request.url).searchParams;
    const cursorKey = "before";
    const paged = [
      "profile",
      "spaceList",
      "spaceEvents",
      "spacePosts",
      "spaceFeed",
      "spacePhotos",
      "commentsRead",
    ].includes(operation);
    const allowedKeys =
      operation === "spaceEvents"
        ? [cursorKey, "q"]
        : operation === "spaceInviteCandidates"
          ? ["q"]
          : operation === "commentsRead"
            ? [cursorKey, "comment"]
            : paged
              ? [cursorKey]
              : [];
    if (
      [...query.keys()].some(
        (key) => !allowedKeys.includes(key) || query.getAll(key).length > 1,
      )
    )
      throw new SocialError(400, "Unexpected query parameters");
    const before = query.has(cursorKey)
      ? idSchema.parse(query.get(cursorKey))
      : undefined;
    const mutation = ![
      "account",
      "profile",
      "readPost",
      "readPhoto",
      "spaceList",
      "spaceEvents",
      "spaceRead",
      "spaceInviteCandidates",
      "spacePosts",
      "spaceFeed",
      "spacePhotos",
      "commentsRead",
    ].includes(operation);
    if (mutation) mutationOrigin(request);
    // Applies to reads too: avoid unrestricted object-store/DB amplification.
    await enforceRateLimit(
      operation === "readPhoto"
        ? "media"
        : mutation
          ? operation.startsWith("space") || operation === "commentCreate"
            ? "spaceWrite"
            : "mutation"
          : "read",
      subject,
    );
    const service = new SpaceService(getDb(), privatePhotoStore);
    const id =
      resourceId === undefined ? undefined : idSchema.parse(resourceId);
    let result: unknown;
    switch (operation) {
      case "spaceSchedule":
        await service.updateEventSchedule(
          subject,
          id!,
          eventScheduleInput.parse(await json(request)).endsAt,
        );
        break;
      case "spaceEventOpen": {
        eventJoinInput.parse(await json(request));
        result = await service.joinTicketmasterEvent(subject, id!);
        break;
      }
      case "spaceEvents":
        result = await service.searchEvents(
          subject,
          eventSearchInput.parse(query.get("q") ?? ""),
          before,
        );
        break;
      case "spaceJoin":
        result = await service.joinEvent(subject, id!);
        break;
      case "spacePosts":
        result = await service.posts(subject, id!, before);
        break;
      case "spacePublish": {
        if (
          request.headers
            .get("content-type")
            ?.startsWith("multipart/form-data;")
        )
          await service.readSpace(subject, id!);
        const draft = await postDraftRequest(request);
        result = draft.files.length
          ? await service.publishWithUploads(
              subject,
              id!,
              draft.input,
              draft.files,
            )
          : await service.publish(subject, id!, draft.input);
        break;
      }
      case "spacePhotos":
        result = await service.reusablePhotos(subject, id!, before);
        break;
      case "spaceFeed":
        result = await service.feed(subject, before);
        break;
      case "commentsRead":
        result = await service.comments(
          subject,
          id!,
          before,
          query.has("comment")
            ? idSchema.parse(query.get("comment"))
            : undefined,
        );
        break;
      case "commentCreate":
        result = await service.comment(
          subject,
          id!,
          commentInput.parse(await json(request)),
        );
        break;
      case "spaceDelete":
        await service.deleteSpace(subject, id!);
        break;
      case "spaceList":
        result = await service.listSpaces(subject, before);
        break;
      case "spaceCreate":
        result = await service.createSpace(
          subject,
          spaceInput.parse(await json(request)),
        );
        break;
      case "spaceRead":
        result = await service.readSpace(subject, id!);
        break;
      case "spaceUpdate":
        await service.updateSpace(
          subject,
          id!,
          spaceInput.parse(await json(request)),
        );
        break;
      case "spaceInviteCandidates":
        result = await service.invitationCandidates(
          subject,
          id!,
          query.get("q") ?? "",
        );
        break;
      case "spaceInvite":
        result = await service.invite(
          subject,
          id!,
          z
            .strictObject({ targetId: spaceResourceId })
            .parse(await json(request)).targetId,
        );
        break;
      case "spaceAccept":
        result = await service.accept(subject, id!);
        break;
      case "spaceMember":
        await service.member(
          subject,
          id!,
          memberInput.parse(await json(request)),
        );
        break;
      case "spaceArchive":
        await service.archive(subject, id!);
        break;
      case "report":
        result = await service.createReport(
          subject,
          reportSchema.parse(await json(request)),
        );
        break;
      case "account":
        result = await service.account(subject);
        break;
      case "profile":
        result = await service.profile(subject, id!, before);
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
      case "spaceUpload":
      case "createPhotoPost": {
        const type = request.headers.get("content-type") ?? "";
        // Active-account check before accepting a large body; rechecked inside the transaction.
        if ((await service.account(subject))?.accountStatus !== "ACTIVE")
          throw new SocialError(403, "Account is not active");
        result = await service.createPhotoPost(
          subject,
          await boundedBody(request, PHOTO_MAX_BYTES),
          type,
          "Photograph",
          operation === "spaceUpload" ? id! : undefined,
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
      case "deletePost": {
        const input = request.body
          ? z
              .strictObject({ deletePhotos: z.boolean().default(false) })
              .parse(await json(request))
          : { deletePhotos: false };
        await service.deletePost(subject, id!, input.deletePhotos);
        break;
      }
      case "deletePhoto":
        await service.deletePhoto(subject, id!);
        break;
    }
    return result === undefined
      ? new Response(null, { status: 204, headers: privateHeaders })
      : Response.json(result, {
          headers: privateHeaders,
          status:
            operation.startsWith("create") ||
            [
              "spaceCreate",
              "spaceInvite",
              "spacePublish",
              "spaceUpload",
              "commentCreate",
            ].includes(operation)
              ? 201
              : 200,
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
