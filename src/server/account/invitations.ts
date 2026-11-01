import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/server/db";
export const INVITATION_COOKIE = "margin_invitation";
export const invitationDigest = (code: string) =>
  createHash("sha256").update(code.trim()).digest("hex");
export async function readInvitation(subject?: string) {
  if (process.env.MARGIN_REGISTRATION_ENABLED !== "1") return null;
  const code = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!code || !/^[A-Za-z0-9_-]{32,128}$/.test(code)) return null;
  const invitation = await getDb().invitation.findUnique({
    where: { digest: invitationDigest(code) },
  });
  if (
    !invitation ||
    invitation.expiresAt <= new Date() ||
    (invitation.claimedBy && invitation.claimedBy !== subject)
  )
    return null;
  return invitation;
}
