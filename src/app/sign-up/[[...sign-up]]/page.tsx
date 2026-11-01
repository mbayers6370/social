import { Suspense } from "react";
import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { AuthShell, authAppearance } from "@/features/account/auth-shell";
import { acceptInvitation } from "@/server/account/actions";
import { InvitationForm } from "@/features/account/invitation-form";
import { readInvitation } from "@/server/account/invitations";
export const metadata: Metadata = {
  title: "Join Margin",
  description: "Start your Margin account with an invitation code.",
};
export default async function SignUpPage() {
  let invited = false;
  try {
    invited = Boolean(await readInvitation());
  } catch {
    /* Closed when registration infrastructure is unavailable. */
  }
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );
  return (
    <AuthShell
      title="A place for your people."
      intro="Join with an invitation."
    >
      {configured && invited ? (
        <Suspense fallback={<p role="status">Loading account setup…</p>}>
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/onboarding"
            appearance={authAppearance}
          />
        </Suspense>
      ) : (
        <div className="margin-auth-unavailable">
          <InvitationForm
            verify={acceptInvitation}
            enabled={
              configured && process.env.MARGIN_REGISTRATION_ENABLED === "1"
            }
          />
          {process.env.NODE_ENV === "development" && (
            <Link href="/onboarding" className="margin-auth-local-setup">
              Preview profile setup
            </Link>
          )}
        </div>
      )}
      <p className="margin-auth-next">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </AuthShell>
  );
}
