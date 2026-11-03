import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { accountConfiguration } from "./config";
import { getDb } from "@/server/db";
import { invitationToken, linkUnavailable } from "./invitation-links";
export const INVITATION_COOKIE = "margin_invitation";
export const invitationDigest = (code: string) =>
  createHash("sha256").update(code.trim()).digest("hex");

/** Resume an operator-reserved founder invitation only for its verified identity.
 * Rendering this control never claims the invitation or writes a cookie. */
export async function readFounderSetupInvitation(
  subject: string,
  verifiedEmail: string,
) {
  if (!accountConfiguration().registrationEnabled || !subject || !verifiedEmail)
    return null;
  const invitation = await getDb().invitation.findFirst({
    where: {
      founderSubject: subject,
      email: verifiedEmail.trim().toLowerCase(),
      linkId: null,
      revokedAt: null,
      claimedBy: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return invitation ? invitationToken("claim", invitation.id) : null;
}
export async function readInvitation(subject?: string) {
  if (!accountConfiguration().registrationEnabled) return null;
  const code = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!code || !/^[A-Za-z0-9_-]{32,128}$/.test(code)) return null;
  const invitation = await getDb().invitation.findUnique({
    where: { digest: invitationDigest(code) },
  });
  if (
    !invitation ||
    invitation.expiresAt <= new Date() ||
    invitation.revokedAt ||
    (invitation.founderSubject && invitation.founderSubject !== subject) ||
    (invitation.claimedBy && invitation.claimedBy !== subject)
  )
    return null;
  if (invitation.linkId) {
    const link = await getDb().invitationLink.findUnique({
      where: { id: invitation.linkId },
    });
    if (linkUnavailable(link)) return null;
  }
  return invitation;
}
