import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { accountConfiguration } from "@/server/account/config";
import { ManagedAuthForm } from "@/features/account/managed-auth-form";
import { AuthShell } from "@/features/account/auth-shell";
import { readInvitation } from "@/server/account/invitations";
export const metadata: Metadata = {
  title: "Join Margin",
  description: "Start your Margin account from your personal invitation link.",
};
export default async function SignUpPage() {
  let invited = false;
  try {
    invited = Boolean(await readInvitation());
  } catch {
    /* Closed when registration infrastructure is unavailable. */
  }
  const { configured, registrationEnabled } = accountConfiguration();
  if (registrationEnabled && invited && (await auth()).userId)
    redirect("/onboarding");
  return (
    <AuthShell
      providerHeading={configured && registrationEnabled && invited}
      title="A place for your people."
      intro="Join with an invitation."
    >
      {configured && registrationEnabled && invited ? (
        <Suspense fallback={<p role="status">Loading account setup…</p>}>
          <ManagedAuthForm kind="sign-up" />
        </Suspense>
      ) : (
        <div className="margin-auth-unavailable">
          <p>
            Margin grows by invitation. Open the invitation link someone sent
            you to begin.
          </p>
          {!registrationEnabled && (
            <p role="status">
              Registration is currently closed. Invitations have not been used.
            </p>
          )}
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
