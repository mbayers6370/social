import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { accountConfiguration } from "@/server/account/config";
import { ManagedAuthForm } from "@/features/account/managed-auth-form";
import { AuthShell } from "@/features/account/auth-shell";
export const metadata: Metadata = {
  title: "Sign in to Margin",
  description: "Sign in to your Margin account.",
};
export default function SignInPage() {
  const { configured } = accountConfiguration();
  return (
    <AuthShell
      providerHeading={configured}
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
          <ManagedAuthForm kind="sign-in" />
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
        New to Margin? Open the invitation link someone sent you.
      </p>
    </AuthShell>
  );
}
