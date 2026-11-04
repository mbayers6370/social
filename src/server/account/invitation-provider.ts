import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { randomBytes } from "node:crypto";
import { SocialError } from "../social/errors";
import {
  digestToken,
  emailInput,
  invitationToken,
  invitationTransaction,
  linkUnavailable,
  lookupInvitationLink,
} from "./invitation-links";

export type ProviderInvitation = {
  id: string;
  emailAddress: string;
  status: string;
  publicMetadata: Record<string, unknown> | null;
};
export type InvitationProvider = {
  find: (query: string) => Promise<ProviderInvitation[]>;
  create: (
    email: string,
    redirectUrl: string,
    claimId: string,
  ) => Promise<ProviderInvitation>;
  revoke: (id: string) => Promise<unknown>;
};
/** Persist the delivery intent first. An ambiguous send is reconciled, never blindly repeated. */
export async function requestInvitationEmail(
  db: PrismaClient,
  provider: InvitationProvider,
  token: string,
  rawEmail: string,
  origin: string,
  now = new Date(),
) {
  const email = emailInput.parse(rawEmail);
  const link = await lookupInvitationLink(db, token);
  const unavailable = linkUnavailable(link, now);
  if (unavailable || !link) throw new SocialError(410, unavailable!);
  const intent = await invitationTransaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 1))`;
    const current = await tx.invitationLink.findUnique({
      where: { id: link.id },
    });
    const reason = linkUnavailable(current, now);
    if (reason) throw new SocialError(410, reason);
    const owner = await tx.account.findUnique({
      where: { userId: link.createdBy },
    });
    if (owner?.status !== "ACTIVE")
      throw new SocialError(
        410,
        "This invitation is no longer available. Ask for a new link.",
      );
    await tx.invitation.updateMany({
      where: {
        email,
        linkId: { not: null },
        claimedBy: null,
        revokedAt: null,
        expiresAt: { lte: now },
      },
      data: { revokedAt: now },
    });
    const existing = await tx.invitation.findFirst({
      where: { email, linkId: { not: null }, claimedBy: null, revokedAt: null },
    });
    if (existing) {
      // Another link's invitation is never transferred to this sender/campaign.
      if (
        existing.linkId !== link.id ||
        existing.clerkInvitationId ||
        (existing.deliveryAttemptedAt &&
          now.getTime() - existing.deliveryAttemptedAt.getTime() < 120_000)
      )
        return null;
      await tx.invitation.update({
        where: { id: existing.id },
        data: { deliveryAttemptedAt: now },
      });
      return existing;
    }
    const id = randomBytes(16).toString("hex");
    return tx.invitation.create({
      data: {
        id,
        digest: digestToken(invitationToken("claim", id)),
        email,
        linkId: link.id,
        createdBy: link.createdBy,
        expiresAt: link.expiresAt,
        deliveryAttemptedAt: now,
        createdAt: now,
      },
    });
  });
  if (!intent) return;
  // Clear expired/revoked invitations first. Provider failure never permits a new send.
  await synchronizeInvitations(db, provider, now);
  const matching = (await provider.find(email)).find(
    (entry) =>
      entry.emailAddress.toLowerCase() === email &&
      entry.publicMetadata?.marginInvitationId === intent.id,
  );
  let sent = matching;
  if (!sent) {
    try {
      sent = await provider.create(
        email,
        `${origin}/invite/claim/${invitationToken("claim", intent.id)}`,
        intent.id,
      );
    } catch (error) {
      // Clerk rejects existing users/invitations; preserve the same inbox response
      // rather than expose whether an address already has an account.
      if (
        typeof error === "object" &&
        error &&
        "status" in error &&
        error.status === 422
      )
        return;
      throw error;
    }
  }
  if (
    sent.emailAddress.toLowerCase() !== email ||
    !["pending", "accepted"].includes(sent.status)
  )
    throw new Error("Invitation delivery unavailable");
  await db.invitation.update({
    where: { id: intent.id },
    data: { clerkInvitationId: sent.id, providerRevokedAt: null },
  });
  // Revocation/expiry may have raced the network call; compensate immediately.
  await synchronizeInvitations(
    db,
    provider,
    new Date(Math.max(now.getTime(), Date.now())),
  );
}

/** Durable reconciliation: local denial commits first; provider failures remain retryable. */
export async function synchronizeInvitations(
  db: PrismaClient,
  provider: Pick<InvitationProvider, "find" | "revoke">,
  now = new Date(),
  options: { limit?: number; signal?: AbortSignal } = {},
) {
  await db.$executeRaw`UPDATE "Invitation" i SET "revokedAt" = ${now}
    FROM "InvitationLink" l LEFT JOIN "Account" a ON a."userId" = l."createdBy"
    WHERE i."linkId" = l.id AND i."claimedBy" IS NULL AND i."revokedAt" IS NULL
      AND (a."status" IS DISTINCT FROM 'ACTIVE'::"AccountStatus" OR l."acceptedCount" >= l."maxRedemptions")`;
  await db.invitation.updateMany({
    where: {
      linkId: { not: null },
      claimedBy: null,
      revokedAt: null,
      OR: [
        { expiresAt: { lte: now } },
        { link: { revokedAt: { not: null } } },
        { link: { acceptedCount: { gte: 0 }, expiresAt: { lte: now } } },
      ],
    },
    data: { revokedAt: now },
  });
  const pending = await db.invitation.findMany({
    where: {
      linkId: { not: null },
      revokedAt: { not: null },
      providerRevokedAt: null,
    },
    orderBy: [
      { providerCheckedAt: { sort: "asc", nulls: "first" } },
      { id: "asc" },
    ],
    take: Math.min(100, Math.max(1, options.limit ?? 100)),
  });
  let checked = 0;
  for (const invitation of pending) {
    if (options.signal?.aborted) break;
    // Rotate unresolved deliveries through the bounded batch rather than starving later work.
    await db.invitation.update({
      where: { id: invitation.id },
      data: { providerCheckedAt: now },
    });
    checked++;
    const matches = await provider.find(
      invitation.clerkInvitationId ?? invitation.email!,
    );
    const remote = matches.find((entry) =>
      invitation.clerkInvitationId
        ? entry.id === invitation.clerkInvitationId
        : entry.publicMetadata?.marginInvitationId === invitation.id,
    );
    // An ambiguous/in-flight delivery may not appear yet. Keep its retry marker.
    if (!remote && !invitation.clerkInvitationId) continue;
    if (remote?.status === "pending") await provider.revoke(remote.id);
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        providerRevokedAt: now,
        ...(remote ? { clerkInvitationId: remote.id } : {}),
      },
    });
  }
  return checked;
}

export async function checkProviderInvitation(
  provider: InvitationProvider,
  invitation: {
    clerkInvitationId: string | null;
    id: string;
    email: string | null;
  },
  acceptedOnly = false,
) {
  if (!invitation.clerkInvitationId || !invitation.email) return false;
  const matches = await provider.find(invitation.clerkInvitationId);
  const found = matches.find(
    (item) => item.id === invitation.clerkInvitationId,
  );
  return Boolean(
    found &&
    found.emailAddress.toLowerCase() === invitation.email.toLowerCase() &&
    found.publicMetadata?.marginInvitationId === invitation.id &&
    (acceptedOnly
      ? found.status === "accepted"
      : ["pending", "accepted"].includes(found.status)),
  );
}
