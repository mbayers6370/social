import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { invitationToken, digestToken } from "./invitation-links";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";

type Identity = { subject: string; verifiedEmail: string };
type Profile = { name: string; username: string; bio: string };
export class AccountSetupError extends Error {}

/** Operator-only first-account recovery for an ALREADY verified Clerk identity.
 * Never signs up a provider user, bypasses profile/age confirmation, or activates it. */
export async function prepareFounderInvitation(
  db: PrismaClient,
  identity: Identity,
  now = new Date(),
) {
  if (!identity.subject || !identity.verifiedEmail)
    throw new AccountSetupError("A verified existing identity is required.");
  return transaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('margin:first-founder', 0))`;
    if (await tx.account.count({ where: { status: "ACTIVE" } }))
      throw new AccountSetupError(
        "An active community already exists. Use its normal invitation or explicit founder role assignment.",
      );
    const reserved = await tx.invitation.findFirst({
      where: {
        founderSubject: { not: null },
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (reserved && reserved.founderSubject !== identity.subject)
      throw new AccountSetupError(
        "First-founder setup is already reserved for another identity.",
      );
    if (reserved) return invitationToken("claim", reserved.id);
    const id = randomBytes(16).toString("hex");
    const token = invitationToken("claim", id);
    await tx.invitation.create({
      data: {
        id,
        digest: digestToken(token),
        email: identity.verifiedEmail.toLowerCase(),
        founderSubject: identity.subject,
        expiresAt: new Date(now.getTime() + 30 * 86400000),
      },
    });
    return token;
  });
}

/** Retry serialization conflicts only; uniqueness failures remain user-visible. */
async function transaction<T>(
  db: PrismaClient,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(run, { isolationLevel: "Serializable" });
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error ? error.code : "";
      if (code === "P2034" && attempt < 2) continue;
      if (code === "P2002")
        throw new AccountSetupError(
          "That username is unavailable. Choose another one.",
        );
      throw error;
    }
  }
}

/** The caller supplies a provider-verified subject/email, never submitted identity fields. */
export async function completeAccountOnboarding(
  db: PrismaClient,
  identity: Identity,
  profile: Profile,
  code: string | null,
  now = new Date(),
) {
  if (!identity.subject || !identity.verifiedEmail)
    throw new AccountSetupError("A verified identity is required.");
  return transaction(db, async (tx) => {
    // Serialize retries and duplicate submissions for this immutable Clerk subject.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.subject}, 0))`;
    const existing = await tx.user.findUnique({
      where: { clerkId: identity.subject },
      include: { account: true },
    });
    if (existing?.account?.status === "DEACTIVATED")
      throw new AccountSetupError("This account is unavailable.");
    if (existing?.account?.onboardedAt)
      return { status: existing.account.status };
    if (!code || !/^[A-Za-z0-9_-]{32,128}$/.test(code))
      throw new AccountSetupError(
        "A valid invitation is required to finish account setup.",
      );
    const digest = createHash("sha256").update(code).digest("hex");
    const invitation = await tx.invitation.findUnique({ where: { digest } });
    if (
      !invitation ||
      invitation.revokedAt ||
      (invitation.founderSubject &&
        invitation.founderSubject !== identity.subject) ||
      invitation.expiresAt <= now ||
      (invitation.claimedBy && invitation.claimedBy !== identity.subject) ||
      (invitation.email &&
        invitation.email.toLowerCase() !== identity.verifiedEmail.toLowerCase())
    )
      throw new AccountSetupError(
        "That invitation is unavailable or does not match your verified email.",
      );
    if (invitation.linkId && !invitation.claimedBy) {
      if (!invitation.email || !invitation.clerkInvitationId)
        throw new AccountSetupError(
          "Verify your invitation email before continuing.",
        );
      const link = await tx.invitationLink.findUnique({
        where: { id: invitation.linkId },
      });
      const issuer =
        link &&
        (await tx.account.findUnique({ where: { userId: link.createdBy } }));
      if (
        !link ||
        link.revokedAt ||
        link.expiresAt <= now ||
        issuer?.status !== "ACTIVE"
      )
        throw new AccountSetupError(
          "This invitation is no longer available. Ask for a new link.",
        );
      const accepted = await tx.invitationLink.updateMany({
        where: {
          id: link.id,
          revokedAt: null,
          expiresAt: { gt: now },
          acceptedCount: { lt: link.maxRedemptions },
        },
        data: { acceptedCount: { increment: 1 } },
      });
      if (accepted.count !== 1)
        throw new AccountSetupError(
          "This invitation has already been used. Ask for a new link.",
        );
      if (link.acceptedCount + 1 >= link.maxRedemptions)
        await tx.invitation.updateMany({
          where: {
            linkId: link.id,
            id: { not: invitation.id },
            claimedBy: null,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
    }
    const claimed = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        expiresAt: { gt: now },
        revokedAt: null,
        OR: [{ claimedBy: null }, { claimedBy: identity.subject }],
      },
      data: { claimedBy: identity.subject, claimedAt: now },
    });
    if (claimed.count !== 1)
      throw new AccountSetupError("That invitation is no longer available.");
    const owner =
      existing ??
      (await tx.user.create({ data: { clerkId: identity.subject } }));
    // A verified personal/community invitation is the membership approval.
    // Bootstrap/legacy reservations retain their separate operator-only recovery.
    const invitedMember = Boolean(
      invitation.linkId && !invitation.founderSubject,
    );
    const activation = invitedMember
      ? {
          status: "ACTIVE" as const,
          ...(!existing?.account?.invitationAllowanceGrantedAt
            ? {
                invitationsRemaining: 3,
                invitationAllowanceGrantedAt: now,
              }
            : {}),
        }
      : {};
    const account = await tx.account.upsert({
      where: { userId: owner.id },
      create: {
        userId: owner.id,
        status: "PENDING",
        ...activation,
        displayName: profile.name,
        username: profile.username,
        bio: profile.bio,
        onboardedAt: now,
        ageConfirmedAt: now,
        emailVerifiedAt: now,
      },
      update: {
        ...activation,
        displayName: profile.name,
        username: profile.username,
        bio: profile.bio,
        onboardedAt: now,
        ageConfirmedAt: now,
        emailVerifiedAt: now,
      },
    });
    return { status: account.status };
  });
}

/** Operator-only. No request can promote its own account through a public endpoint. */
export async function activateAccount(
  db: PrismaClient,
  identity: Identity,
  now = new Date(),
) {
  if (!identity.subject || !identity.verifiedEmail)
    throw new AccountSetupError(
      "A currently verified provider identity is required.",
    );
  return transaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.subject}, 0))`;
    const user = await tx.user.findUnique({
      where: { clerkId: identity.subject },
      include: { account: true },
    });
    if (
      !user?.account ||
      !user.account.onboardedAt ||
      !user.account.ageConfirmedAt ||
      !user.account.username ||
      user.account.status === "DEACTIVATED"
    )
      throw new AccountSetupError(
        "Only a completed, pending account can be activated.",
      );
    if (user.account.status === "ACTIVE") return { status: "ACTIVE" as const };
    const invitation = await tx.invitation.findFirst({
      where: { claimedBy: identity.subject },
    });
    if (
      !invitation ||
      (invitation.email &&
        invitation.email.toLowerCase() !== identity.verifiedEmail.toLowerCase())
    )
      throw new AccountSetupError(
        "The account has no matching claimed invitation.",
      );
    await tx.account.update({
      where: { userId: user.id },
      data: {
        status: "ACTIVE",
        ...(invitation.founderSubject === identity.subject
          ? { role: "FOUNDER" }
          : {}),
        emailVerifiedAt: now,
        ...(!user.account.invitationAllowanceGrantedAt
          ? { invitationsRemaining: 3, invitationAllowanceGrantedAt: now }
          : {}),
      },
    });
    return { status: "ACTIVE" as const };
  });
}
