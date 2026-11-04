"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import {
  ClerkLoaded,
  ClerkLoading,
  ClerkFailed,
  ClerkDegraded,
  SignIn,
  SignUp,
  useClerk,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { authAppearance } from "./clerk-appearance";

export function AuthenticationRetry() {
  return (
    <div className="margin-auth-unavailable" role="alert">
      <h1>Account access</h1>
      <p>
        Authentication is temporarily unavailable. Please try again in a moment.
      </p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
function LoadingAuthentication() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 12_000);
    return () => clearTimeout(timer);
  }, []);
  return timedOut ? (
    <AuthenticationRetry />
  ) : (
    <div className="margin-auth-unavailable">
      <h1>Account access</h1>
      <p role="status">Loading secure account access…</p>
    </div>
  );
}
class AuthenticationBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <AuthenticationRetry /> : this.props.children;
  }
}
function ReadyForm({ kind }: { kind: "sign-in" | "sign-up" }) {
  const clerk = useClerk();
  if (clerk.status !== "ready") return null;
  return kind === "sign-in" ? (
    <SignIn
      withSignUp={false}
      transferable={false}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      forceRedirectUrl="/app/feed"
      appearance={authAppearance}
    />
  ) : (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl="/onboarding"
      appearance={authAppearance}
    />
  );
}
/** Passwords, email challenges, MFA and recovery remain entirely inside Clerk. */
export function ManagedAuthForm({ kind }: { kind: "sign-in" | "sign-up" }) {
  return (
    <AuthenticationBoundary>
      <ClerkLoading>
        <LoadingAuthentication />
      </ClerkLoading>
      <ClerkFailed>
        <AuthenticationRetry />
      </ClerkFailed>
      <ClerkDegraded>
        <AuthenticationRetry />
      </ClerkDegraded>
      <ClerkLoaded>
        <ReadyForm kind={kind} />
      </ClerkLoaded>
    </AuthenticationBoundary>
  );
}
