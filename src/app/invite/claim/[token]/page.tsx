import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { requireAccountSession } from "@/server/auth";
import { AccountControls } from "@/features/account/account-controls";
import { AuthShell } from "@/features/account/auth-shell";
import { InvitationClaim } from "@/features/account/invitation-landing";
import { acceptInvitation } from "@/server/account/actions";
import { accountConfiguration } from "@/server/account/config";
import {
  digestToken,
  linkUnavailable,
  tokenValid,
} from "@/server/account/invitation-links";
import { getDb } from "@/server/db";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your Margin invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ __clerk_ticket?: string }>;
}) {
  const { token } = await params;
  const ticket = (await searchParams).__clerk_ticket ?? "";
  let available = false;
  let founderSetup = false;
  let wrongAccount = false;
  if (
    tokenValid(token) &&
    accountConfiguration().registrationEnabled &&
    process.env.MARGIN_PRIVATE_BACKEND_ENABLED === "1"
  ) {
    try {
      const invitation = await getDb().invitation.findUnique({
        where: { digest: digestToken(token) },
        include: { link: true },
      });
      founderSetup = Boolean(invitation?.founderSubject);
      available = Boolean(
        invitation &&
        !invitation.revokedAt &&
        !invitation.claimedBy &&
        invitation.expiresAt > new Date() &&
        (founderSetup ||
          (invitation.link &&
            invitation.clerkInvitationId &&
            !linkUnavailable(invitation.link))),
      );
      if (available && !founderSetup && (await auth()).userId) {
        const identity = await requireAccountSession({ verifiedEmail: false });
        wrongAccount =
          identity.verifiedEmail?.toLowerCase() !==
          invitation?.email?.toLowerCase();
      }
    } catch {
      available = false;
      /* Fail closed without exposing provider/database details. */
    }
  }
  return (
    <AuthShell
      title={
        available
          ? wrongAccount
            ? "Use your invited account."
            : "Your invitation is here."
          : "Let’s find a fresh invitation."
      }
      intro={
        available
          ? wrongAccount
            ? "You’re signed in to a different account. Sign out, then reopen this invitation email to continue."
            : "Continue with the email address this invitation was sent to, then complete your profile to join."
          : "This invitation has expired, been used, or is unavailable. Ask the person who invited you for a new link."
      }
    >
      {available && founderSetup && (
        <p>
          Sign in with the existing account selected for first-founder setup,
          then return to this link. This does not activate your account.{" "}
          <Link href="/sign-in">Sign in</Link>
        </p>
      )}
      {available && wrongAccount && <AccountControls />}
      {available && !wrongAccount && (
        <InvitationClaim
          token={token}
          ticket={ticket}
          accept={acceptInvitation}
        />
      )}
      {!available && (
        <p className="margin-auth-next">
          Already joined? <Link href="/sign-in">Sign in</Link>.
        </p>
      )}
    </AuthShell>
  );
}
