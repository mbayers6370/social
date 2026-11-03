import { clerkInvitationProvider } from "./invitation-clerk";
import "server-only";
import { z } from "zod";
import { requireAccountSession, UnauthorizedError } from "../auth";
import { getDb } from "../db";
import { enforceRateLimit, RateLimitError } from "../security/rate-limit";
import { json, mutationOrigin, privateHeaders } from "../social/http";
import { SocialError } from "../social/errors";
import { accountConfiguration } from "./config";
import {
  digestToken,
  emailInput,
  invitationOwner,
  invitationToken,
  invitationTransaction,
  issueInvitationLink,
  linkInput,
} from "./invitation-links";
import {
  requestInvitationEmail,
  synchronizeInvitations,
} from "./invitation-provider";

const issueInput = linkInput.extend({ email: emailInput.optional() });

export async function invitationEmailLimits(token: string, email: string) {
  await enforceRateLimit("invitationEmailGlobal", "all");
  await enforceRateLimit("invitationEmailLink", digestToken(token));
  await enforceRateLimit("invitationEmailAddress", digestToken(email));
}

export async function invitationRequest(
  request: Request,
  operation: "list" | "issue" | "revoke" | "email",
  id?: string,
) {
  try {
    const configuration = accountConfiguration();
    if (
      !configuration.registrationEnabled ||
      process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1"
    )
      throw new SocialError(503, "Invitations are not open yet.");
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some(
        (key) =>
          operation !== "list" ||
          key !== "before" ||
          query.getAll(key).length !== 1,
      )
    )
      throw new SocialError(400, "Unexpected query parameters");
    if (operation !== "list") mutationOrigin(request);
    const db = getDb();
    if (operation === "email") {
      const input = z
        .strictObject({ email: emailInput })
        .parse(await json(request));
      await invitationEmailLimits(id!, input.email);
      await requestInvitationEmail(
        db,
        await clerkInvitationProvider(),
        id!,
        input.email,
        configuration.origin!,
      );
      return Response.json(
        {
          message:
            "Check your inbox for your personal invitation. If you already have an account, sign in instead.",
        },
        { headers: privateHeaders, status: 202 },
      );
    }
    const session = await requireAccountSession();
    await enforceRateLimit(
      operation === "list" ? "read" : "mutation",
      session.subject,
    );
    if (operation === "issue") {
      const input = issueInput.parse(await json(request));
      const { link, token } = await issueInvitationLink(
        db,
        session.subject,
        input,
      );
      if (input.email) {
        await invitationEmailLimits(token, input.email);
        await requestInvitationEmail(
          db,
          await clerkInvitationProvider(),
          token,
          input.email,
          configuration.origin!,
        );
      }
      return Response.json(
        {
          id: link.id,
          url: `${configuration.origin}/invite/${token}`,
          expiresAt: link.expiresAt,
          community: link.community,
          maximum: link.maxRedemptions,
          label: link.label,
        },
        { headers: privateHeaders, status: 201 },
      );
    }
    if (operation === "revoke") {
      await invitationTransaction(db, async (tx) => {
        const owner = await invitationOwner(tx, session.subject);
        const link = await tx.invitationLink.findFirst({
          where: { id, createdBy: owner.id },
        });
        if (!link) throw new SocialError(404, "Invitation not found.");
        const now = new Date();
        await tx.invitationLink.update({
          where: { id: link.id },
          data: { revokedAt: link.revokedAt ?? now },
        });
        await tx.invitation.updateMany({
          where: { linkId: link.id, claimedBy: null, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      let providerPending = false;
      try {
        await synchronizeInvitations(db, await clerkInvitationProvider());
      } catch {
        providerPending = true;
      }
      const remaining = await db.invitation.count({
        where: {
          linkId: id,
          revokedAt: { not: null },
          providerRevokedAt: null,
        },
      });
      return Response.json(
        { revoked: true, providerPending: providerPending || remaining > 0 },
        { headers: privateHeaders },
      );
    }
    const owner = await invitationOwner(db, session.subject);
    const before = query.get("before");
    const anchor = before
      ? await db.invitationLink.findFirst({
          where: {
            id: z
              .string()
              .regex(/^[a-f0-9]{32}$/)
              .parse(before),
            createdBy: owner.id,
          },
        })
      : null;
    if (before && !anchor)
      throw new SocialError(404, "Invitation page not found.");
    const links = await db.invitationLink.findMany({
      where: {
        createdBy: owner.id,
        ...(anchor
          ? {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { lt: anchor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    const more = links.length > 50;
    if (more) links.pop();
    return Response.json(
      {
        founder: owner.account.role === "FOUNDER",
        remaining: owner.account.invitationsRemaining,
        nextCursor: more ? links.at(-1)!.id : null,
        links: links.map((link) => ({
          id: link.id,
          url: `${configuration.origin}/invite/${invitationToken("link", link.id)}`,
          community: link.community,
          label: link.label,
          expiresAt: link.expiresAt,
          revoked: Boolean(link.revokedAt),
          accepted: link.acceptedCount,
          maximum: link.maxRedemptions,
        })),
      },
      { headers: privateHeaders },
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
            : status === 429
              ? "Too many attempts. Please wait before trying again."
              : status === 401
                ? "Sign in to continue."
                : status === 400
                  ? "Check your invitation details."
                  : "Invitations are temporarily unavailable. Your existing links are still saved. Please try again.",
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
