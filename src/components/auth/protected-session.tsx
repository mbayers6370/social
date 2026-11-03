"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAccountSession } from "./account-session";

type ProviderState = {
  ready: boolean;
  signedIn: boolean;
  available: boolean;
  sessionId: string | null;
};
type Access = "checking" | "ready" | "ended" | "unavailable" | "blocked";
export function ProtectedSession({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const session = useAccountSession();
  return (
    <SessionAccess
      expectedSessionId={sessionId}
      provider={{
        ready: session?.ready ?? false,
        signedIn: session?.signedIn ?? false,
        available: session?.available ?? false,
        sessionId: session?.managed ? session.loginSessionId : null,
      }}
    >
      {children}
    </SessionAccess>
  );
}
/** Presentation only. The session endpoint independently verifies every request. */
export function SessionAccess(props: {
  expectedSessionId: string;
  provider: ProviderState;
  children: ReactNode;
}) {
  const { expectedSessionId, provider } = props;
  const identity = `${expectedSessionId}:${provider.sessionId}:${provider.ready}:${provider.available}:${provider.signedIn}`;
  return <SessionVerification key={identity} {...props} />;
}
function SessionVerification({
  expectedSessionId,
  provider,
  children,
}: {
  expectedSessionId: string;
  provider: ProviderState;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<Access>("checking");
  const pending = useRef<AbortController | null>(null);
  const check = useCallback(() => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    void fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setAccess("ended");
          return;
        }
        if (response.status === 403) {
          setAccess("blocked");
          return;
        }
        if (!response.ok) {
          setAccess("unavailable");
          return;
        }
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        setAccess(
          typeof data === "object" &&
            data !== null &&
            "sessionId" in data &&
            data.sessionId === expectedSessionId
            ? "ready"
            : "ended",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setAccess("unavailable");
      })
      .finally(() => {
        if (pending.current === controller) pending.current = null;
      });
  }, [expectedSessionId]);
  useEffect(() => {
    if (
      !provider.ready ||
      !provider.available ||
      !provider.signedIn ||
      provider.sessionId !== expectedSessionId
    )
      return;
    check();
    const visible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 60_000);
    return () => {
      clearInterval(timer);
      pending.current?.abort();
      pending.current = null;
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [
    check,
    expectedSessionId,
    provider.ready,
    provider.available,
    provider.signedIn,
    provider.sessionId,
  ]);
  if (!provider.ready) return <p role="status">Checking your session…</p>;
  const state = !provider.available
    ? "unavailable"
    : !provider.signedIn || provider.sessionId !== expectedSessionId
      ? "ended"
      : access;
  if (state === "ready") return children;
  if (state === "checking") return <p role="status">Checking your session…</p>;
  return (
    <section
      className="margin-account-access"
      aria-labelledby="account-access-title"
    >
      <h1 id="account-access-title">
        {state === "ended"
          ? "Your session has ended."
          : state === "blocked"
            ? "Account access is unavailable."
            : "We couldn’t verify your session."}
      </h1>
      <p role="alert">
        {state === "ended"
          ? "Sign in again to continue."
          : state === "blocked"
            ? "Check your verified email and account status before continuing."
            : "Account services may be unavailable. Check your connection and try again."}
      </p>
      {state === "unavailable" && (
        <Button
          variant="outline"
          onClick={
            provider.available
              ? () => {
                  setAccess("checking");
                  check();
                }
              : () => window.location.reload()
          }
        >
          Try again
        </Button>
      )}
      <Link
        href={
          state === "blocked" ? "/onboarding" : "/sign-in?reason=session-ended"
        }
      >
        {state === "blocked" ? "Review account setup" : "Return to sign in"}
      </Link>
    </section>
  );
}
