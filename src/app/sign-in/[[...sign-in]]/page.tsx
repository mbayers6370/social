import { Suspense } from "react";
import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthShell, authAppearance } from "@/features/account/auth-shell";
export const metadata: Metadata = {
  title: "Sign in to Margin",
  description: "Sign in to your Margin account.",
};
export default function SignInPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );
  return (
    <AuthShell
      title="Welcome back."
      intro={
        configured
          ? "Sign in to pick up where you left off."
          : process.env.NODE_ENV === "development"
            ? "Live sign-in isn’t available in this preview."
            : "Sign-in is temporarily unavailable."
      }
    >
      {configured ? (
        <Suspense fallback={<p role="status">Loading sign-in…</p>}>
          <SignIn
            withSignUp={false}
            transferable={false}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/onboarding"
            appearance={authAppearance}
          />
        </Suspense>
      ) : (
        <div className="margin-auth-unavailable">
          {process.env.NODE_ENV === "development" ? (
            <>
              <Link
                href="/"
                className={buttonVariants({
                  className: "margin-auth-primary-action",
                })}
              >
                Explore the preview
              </Link>
              <p className="margin-auth-preview-note">
                Sample people. Changes reset on refresh.
              </p>
            </>
          ) : (
            <p>Please try again later.</p>
          )}
        </div>
      )}
      <p className="margin-auth-next">
        Have an invitation? <Link href="/sign-up">Join Margin</Link>
      </p>
    </AuthShell>
  );
}
