import { portraitVersionSchema } from "@/lib/portrait-crop";
import "server-only";
import { eventSpacesEnabled } from "@/features/spaces/availability";
import { z } from "zod";
import { requireViewer, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { privatePhotoStore } from "@/server/social/photo";
import {
  boundedBody,
  postDraftRequest,
  json,
  mutationOrigin,
  privateHeaders,
} from "@/server/social/http";
import { SocialError } from "@/server/social/errors";
import { MusicError, catalogue } from "@/server/music/catalogue";
import { musicSearchSchema } from "@/features/profile/music-schema";
import {
  memberId,
  memberPortraitInput,
  memberReadInput,
  memberLikeInput,
  memberNotificationInput,
} from "@/features/social/member-schema";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import { MemberService } from "./service";
import { ModerationService } from "@/server/safety/service";

type Operation =
  | "moderationReports"
  | "moderationReport"
  | "moderationReview"
  | "moderationPhoto"
  | "eventAdmin"
  | "postingAllowance"
  | "topFriends"
  | "topFriendsUpdate"
  | "identity"
  | "profileUpdate"
  | "preferences"
  | "username"
  | "portrait"
  | "portraitUpdate"
  | "galleryUpload"
  | "galleryArrange"
  | "musicSearch"
  | "musicSave"
  | "contacts"
  | "threads"
  | "conversation"
  | "messageSend"
  | "conversationRead"
  | "conversationHide"
  | "notifications"
  | "notificationsRead"
  | "like"
  | "safety"
  | "export"
  | "postEdit"
  | "conversationExport"
  | "personalPhotos"
  | "postPublish";
const reads = new Set<Operation>([
  "moderationReports",
  "moderationReport",
  "moderationPhoto",
  "postingAllowance",
  "topFriends",
  "identity",
  "portrait",
  "musicSearch",
  "contacts",
  "threads",
  "conversation",
  "notifications",
  "safety",
  "export",
  "conversationExport",
  "personalPhotos",
]);
export async function memberRequest(
  request: Request,
  operation: Operation,
  rawId?: string,
) {
  try {
    if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1")
      throw new SocialError(503, "Private backend is not enabled");
    const { id: subject } = await requireViewer();
    const id = rawId === undefined ? undefined : memberId.parse(rawId);
    const query = new URL(request.url).searchParams;
    const allowed =
      operation === "moderationPhoto"
        ? ["photoId"]
        : operation === "portrait"
          ? ["v"]
          : ["contacts", "topFriends"].includes(operation)
            ? ["q", "before"]
            : operation === "musicSearch"
              ? ["q"]
              : [
                    "conversation",
                    "notifications",
                    "threads",
                    "personalPhotos",
                    "moderationReports",
                  ].includes(operation)
                ? ["before"]
                : [];
    if (
      [...query.keys()].some(
        (key) => !allowed.includes(key) || query.getAll(key).length > 1,
      )
    )
      throw new SocialError(400, "Unexpected query parameters");
    if (query.has("v")) portraitVersionSchema.parse(query.get("v"));
    const before = query.has("before")
      ? memberId.parse(query.get("before"))
      : undefined;
    if (!reads.has(operation)) mutationOrigin(request);
    await enforceRateLimit(
      operation === "portrait"
        ? "media"
        : ["export", "conversationExport"].includes(operation)
          ? "accountExport"
          : operation === "messageSend"
            ? "messageWrite"
            : operation === "musicSearch"
              ? "musicSearch"
              : reads.has(operation)
                ? "read"
                : "mutation",
      subject,
    );
    const service = new MemberService(getDb(), privatePhotoStore);
    const moderation = new ModerationService(getDb(), privatePhotoStore);
    let result: unknown;
    switch (operation) {
      case "moderationReports":
        result = await moderation.reports(subject, before);
        break;
      case "moderationReport":
        result = await moderation.report(subject, id!);
        break;
      case "moderationReview":
        result = await moderation.review(subject, id!, await json(request));
        break;
      case "eventAdmin":
        result = await moderation.assignEventAdmin(
          subject,
          id!,
          await json(request),
        );
        break;
      case "moderationPhoto":
        return new Response(
          new Uint8Array(
            await moderation.reportPhoto(
              subject,
              id!,
              memberId.parse(query.get("photoId")),
            ),
          ),
          {
            headers: {
              ...privateHeaders,
              "Content-Type": "image/webp",
              "Cross-Origin-Resource-Policy": "same-origin",
            },
          },
        );
      case "postingAllowance":
        result = await service.postingAllowance(subject);
        break;
      case "personalPhotos":
        result = await service.personalPhotos(subject, before);
        break;
      case "postPublish": {
        if ((await service.account(subject))?.accountStatus !== "ACTIVE")
          throw new SocialError(403, "Account is not active");
        const draft = await postDraftRequest(request);
        result = await service.publishPersonal(
          subject,
          draft.input,
          draft.files,
        );
        break;
      }
      case "topFriends":
        result = await service.topFriends(
          subject,
          z
            .string()
            .trim()
            .max(80)
            .parse(query.get("q") ?? ""),
          before,
        );
        break;
      case "topFriendsUpdate":
        result = await service.updateTopFriends(subject, await json(request));
        break;
      case "identity":
        result = await service.identity(subject);
        break;
      case "profileUpdate":
        result = await service.updateProfile(subject, await json(request));
        break;
      case "preferences":
        result = await service.updatePreferences(subject, await json(request));
        break;
      case "username":
        result = await service.updateUsername(subject, await json(request));
        break;
      case "portraitUpdate": {
        const { photoId, crop } = memberPortraitInput.parse(
          await json(request),
        );
        result = await service.setPortrait(subject, photoId, crop);
        break;
      }
      case "portrait":
        return new Response(
          new Uint8Array(await service.portrait(subject, id!)),
          {
            headers: {
              ...privateHeaders,
              "Content-Type": "image/webp",
              "Content-Disposition": 'inline; filename="profile.webp"',
              "Cross-Origin-Resource-Policy": "same-origin",
            },
          },
        );
      case "galleryUpload": {
        if ((await service.account(subject))?.accountStatus !== "ACTIVE")
          throw new SocialError(403, "Account is not active");
        result = await service.uploadGallery(
          subject,
          await boundedBody(request, PHOTO_MAX_BYTES),
          request.headers.get("content-type") ?? "",
          "Photograph",
          request.headers.has("x-gallery-replacement")
            ? memberId.parse(request.headers.get("x-gallery-replacement"))
            : undefined,
        );
        break;
      }
      case "galleryArrange":
        result = await service.arrangeGallery(subject, await json(request));
        break;
      case "musicSave":
        result = await service.music(subject, await json(request));
        break;
      case "musicSearch": {
        if ((await service.account(subject))?.accountStatus !== "ACTIVE")
          throw new SocialError(403, "Account is not active");
        result = {
          tracks: await catalogue.search(
            musicSearchSchema.parse(query.get("q")),
          ),
        };
        break;
      }
      case "contacts":
        result = await service.contacts(
          subject,
          z
            .string()
            .trim()
            .max(80)
            .parse(query.get("q") ?? ""),
          before,
        );
        break;
      case "threads":
        result = await service.threads(subject, before);
        break;
      case "conversation":
        result = await service.conversation(subject, id!, before);
        break;
      case "messageSend":
        result = await service.sendMessage(subject, id!, await json(request));
        break;
      case "conversationExport":
        result = await service.exportConversation(subject, id!);
        break;
      case "conversationRead":
        result = await service.readConversation(
          subject,
          id!,
          memberReadInput.parse(await json(request)).through,
        );
        break;
      case "conversationHide":
        result = await service.hideConversation(subject, id!);
        break;
      case "notifications":
        result = await service.notifications(
          subject,
          before,
          eventSpacesEnabled,
        );
        break;
      case "notificationsRead":
        result = await service.readNotifications(
          subject,
          memberNotificationInput.parse(await json(request)).id,
        );
        break;
      case "like":
        result = await service.like(
          subject,
          id!,
          memberLikeInput.parse(await json(request)).liked,
        );
        break;
      case "safety":
        result = await service.safety(subject);
        break;
      case "export":
        result = await service.exportAccount(subject);
        break;
      case "postEdit":
        result = await service.editPersonalPost(
          subject,
          id!,
          z
            .strictObject({ body: z.string().trim().max(3000) })
            .parse(await json(request)).body,
        );
        break;
    }
    return Response.json(result, {
      status: ["galleryUpload", "messageSend", "postPublish"].includes(
        operation,
      )
        ? 201
        : 200,
      headers: {
        ...privateHeaders,
        ...(operation === "export"
          ? {
              "Content-Disposition":
                'attachment; filename="margin-account.json"',
            }
          : {}),
      },
    });
  } catch (error) {
    const status =
      error instanceof SocialError || error instanceof MusicError
        ? error.status
        : error instanceof UnauthorizedError
          ? 401
          : error instanceof RateLimitError
            ? 429
            : error instanceof z.ZodError
              ? 400
              : 503;
    const message =
      error instanceof SocialError || error instanceof MusicError
        ? error.message
        : status === 401
          ? "Authentication required"
          : status === 429
            ? "Too many requests. Please try again shortly."
            : status === 400
              ? "Invalid request"
              : "This service is temporarily unavailable. Please try again.";
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
