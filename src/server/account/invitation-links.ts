import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { SocialError } from "../social/errors";

export const INVITATION_DAYS = 30;
const day = 86_400_000;
export const linkInput = z.strictObject({
  requestId: z.uuid(),
  community: z.boolean().default(false),
  maxRedemptions: z.number().int().min(1).max(10_000).default(1),
  label: z.string().trim().max(80).optional(),
  expiresAt: z.iso.datetime().optional(),
});
export const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const tokenValid = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const digestToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Domain-separated HMAC lets owners recover their links without storing bearer secrets. */
export function invitationToken(kind: "link" | "claim", id: string) {
  const key = process.env.INVITATION_LINK_SECRET;
  if (!key || key.length < 43)
    throw new Error("Invitation signing is unavailable");
  return createHmac("sha256", key)
    .update(`margin.invitation.${kind}.v1:${id}`)
    .digest("base64url");
}

export async function invitationTransaction<T>(
  db: PrismaClient,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(run, {
        isolationLevel: "Serializable",
        timeout: 20_000,
      });
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error ? error.code : "";
      if ((code === "P2034" || code === "P2002") && attempt < 4) continue;
      throw error;
    }
  }
}

export async function invitationOwner(
  tx: Prisma.TransactionClient,
  subject: string,
) {
  if (!subject) throw new SocialError(401, "Sign in to invite someone.");
  const owner = await tx.user.findUnique({
    where: { clerkId: subject },
    include: { account: true },
  });
  if (owner?.account?.status !== "ACTIVE")
    throw new SocialError(
      403,
      "Invitations become available after your account is approved.",
    );
  return { ...owner, account: owner.account };
}

export async function issueInvitationLink(
  db: PrismaClient,
  subject: string,
  raw: z.input<typeof linkInput>,
  now = new Date(),
) {
  if (process.env.MARGIN_REGISTRATION_ENABLED !== "1")
    throw new SocialError(503, "Invitations are not open yet.");
  const input = linkInput.parse(raw);
  return invitationTransaction(db, async (tx) => {
    const owner = await invitationOwner(tx, subject);
    const founder = owner.account.role === "FOUNDER";
    if (
      !founder &&
      (input.community ||
        input.maxRedemptions !== 1 ||
        input.label ||
        input.expiresAt)
    )
      throw new SocialError(
        403,
        "Only the founder can create community invitations.",
      );
    if (!input.community && input.maxRedemptions !== 1)
      throw new SocialError(400, "Personal invitations welcome one person.");
    const existing = await tx.invitationLink.findUnique({
      where: {
        createdBy_requestId: {
          createdBy: owner.id,
          requestId: input.requestId,
        },
      },
    });
    if (existing) {
      if (
        existing.community !== input.community ||
        existing.maxRedemptions !== input.maxRedemptions ||
        (existing.label ?? "") !== (input.label ?? "") ||
        (input.expiresAt &&
          existing.expiresAt.toISOString() !==
            new Date(input.expiresAt).toISOString())
      )
        throw new SocialError(
          409,
          "This request already created a different invitation. Reload your invitation history before creating another.",
        );
      return { link: existing, token: invitationToken("link", existing.id) };
    }
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(now.getTime() + INVITATION_DAYS * day);
    if (
      expiresAt <= now ||
      expiresAt.getTime() > now.getTime() + INVITATION_DAYS * day
    )
      throw new SocialError(
        400,
        "Choose an expiration within the next 30 days.",
      );
    if (!founder) {
      const quota = await tx.account.updateMany({
        where: {
          userId: owner.id,
          status: "ACTIVE",
          invitationsRemaining: { gt: 0 },
          invitationAllowanceGrantedAt: { not: null },
        },
        data: { invitationsRemaining: { decrement: 1 } },
      });
      if (quota.count !== 1)
        throw new SocialError(
          409,
          "You’ve used your three invitations. Existing links can still be shared until they expire.",
        );
    }
    const id = randomBytes(16).toString("hex");
    const token = invitationToken("link", id);
    const link = await tx.invitationLink.create({
      data: {
        id,
        digest: digestToken(token),
        createdBy: owner.id,
        requestId: input.requestId,
        community: input.community,
        maxRedemptions: input.maxRedemptions,
        label: input.label || null,
        createdAt: now,
        expiresAt,
      },
    });
    return { link, token };
  });
}

export function linkUnavailable(
  link: {
    expiresAt: Date;
    revokedAt: Date | null;
    acceptedCount: number;
    maxRedemptions: number;
  } | null,
  now = new Date(),
) {
  if (!link)
    return "This invitation link isn’t available. Ask the person who invited you for a new one.";
  if (link.revokedAt)
    return "This invitation has been withdrawn. Ask the person who invited you for a new link.";
  if (link.expiresAt <= now)
    return "This invitation has expired. Ask the person who invited you for a new link.";
  if (link.acceptedCount >= link.maxRedemptions)
    return "This invitation has already been used. Ask for a new invitation to join.";
  return null;
}

export async function lookupInvitationLink(db: PrismaClient, token: string) {
  if (!tokenValid(token)) return null;
  return db.invitationLink.findUnique({
    where: { digest: digestToken(token) },
  });
}
