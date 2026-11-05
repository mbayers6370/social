import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/account/auth-shell";
import { AccountControls } from "@/features/account/account-controls";
import { acceptInvitation, saveOnboarding } from "@/server/account/actions";
import { OnboardingForm } from "@/features/account/onboarding-form";
import { accountConfiguration } from "@/server/account/config";
import { requireAccountSession, UnauthorizedError } from "@/server/auth";
import {
  readFounderSetupInvitation,
  readInvitation,
} from "@/server/account/invitations";
import { InvitationClaim } from "@/features/account/invitation-landing";
import { getDb } from "@/server/db";
import { AccountErasureControl } from "@/features/account/account-erasure-control";

export default async function OnboardingPage() {
  const { configured: managed, registrationEnabled } = accountConfiguration();
  if (!managed) {
    if (process.env.NODE_ENV !== "development") redirect("/sign-in");
    redirect("/preview/onboarding");
  }
  let setup;
  try {
    const session = await requireAccountSession({ verifiedEmail: false });
    const owner = await getDb().user.findUnique({
      where: { clerkId: session.subject },
      include: { account: true },
    });
    setup = { session, account: owner?.account };
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    return (
      <AuthShell
        title="Account setup is unavailable."
        intro="We couldn’t check your account. Please try again in a moment."
      >
        <Link href="/onboarding">Try again</Link>
        <AccountControls />
      </AuthShell>
    );
  }
  if (!setup.session.verifiedEmail)
    return (
      <AuthShell
        title="Verify your email."
        intro="Verify your primary email address in Account & security, then return to continue."
      >
        <AccountControls />
        <Link href="/onboarding">I’ve verified my email</Link>
      </AuthShell>
    );
  if (setup.account?.status === "DEACTIVATED")
    return (
      <AuthShell
        title="Your account is unavailable."
        intro="This account no longer has access to Margin."
      >
        <AccountControls />
        <AccountErasureControl />
      </AuthShell>
    );
  if (setup.account?.onboardedAt) {
    if (setup.account.status === "ACTIVE") redirect("/app/feed");
    return (
      <AuthShell
        title="Your account needs attention."
        intro="Your profile is saved, but we couldn’t finish activating your account. Contact support for help."
      >
        <Link href="mailto:support@margin.social">Contact support</Link>
        <AccountControls />
      </AuthShell>
    );
  }
  if (!registrationEnabled)
    return (
      <AuthShell
        title="Registration is currently closed."
        intro="Your invitation has not been used. Account setup will be available when registration opens."
      >
        <AccountControls />
      </AuthShell>
    );
  let invitation;
  let founderToken: string | null = null;
  try {
    invitation = await readInvitation(setup.session.subject);
    if (!invitation)
      founderToken = await readFounderSetupInvitation(
        setup.session.subject,
        setup.session.verifiedEmail,
      );
  } catch {
    return (
      <AuthShell
        title="Invitations are unavailable."
        intro="We couldn’t check your invitation. Please try again in a moment."
      >
        <Link href="/onboarding">Try again</Link>
        <AccountControls />
      </AuthShell>
    );
  }
  if (founderToken)
    return (
      <AuthShell
        title="Make yourself at home."
        intro="Your founder invitation is ready. Continue to complete your profile."
      >
        <InvitationClaim
          token={founderToken}
          ticket=""
          accept={acceptInvitation}
        />
        <AccountControls />
      </AuthShell>
    );
  if (!invitation)
    return (
      <AuthShell
        title="Your invitation"
        intro="Reopen your personal invitation email to finish setting up your account. Your 30-minute setup window may have ended."
      >
        <AccountControls />
      </AuthShell>
    );
  if (
    invitation.email &&
    invitation.email.toLowerCase() !== setup.session.verifiedEmail.toLowerCase()
  )
    return (
      <AuthShell
        title="Check your verified email."
        intro="Use the verified primary email address this invitation was sent to, then reopen that invitation email."
      >
        <AccountControls />
      </AuthShell>
    );
  return (
    <AuthShell
      title="Make yourself at home."
      intro="A name, a little introduction, and room for the people you’ll bring."
    >
      <OnboardingForm
        managed
        saveAction={saveOnboarding}
        initialName={setup.session.user.fullName ?? ""}
        initialUsername={
          setup.account?.username ?? setup.session.user.username ?? ""
        }
      />
    </AuthShell>
  );
}
