"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSession } from "@clerk/nextjs";
import { previewLoginId, endPreviewLogin } from "./login-session";

import { AccountSessionContext as Context } from "./account-session-context";
export { useAccountSession } from "./account-session-context";

export function AccountSession({
  enabled,
  children,
  previewAllowed = process.env.NODE_ENV === "development",
}: {
  enabled: boolean;
  previewAllowed?: boolean;
  children: ReactNode;
}) {
  return enabled ? (
    <ManagedSession>{children}</ManagedSession>
  ) : previewAllowed ? (
    <PreviewSession>{children}</PreviewSession>
  ) : (
    <Context.Provider
      value={{
        ready: true,
        available: false,
        signedIn: false,
        managed: false,
        loginSessionId: null,
        enterPreview: () => {},
        leave: async () => {
          throw Error("Authentication unavailable");
        },
        manage: () => {},
      }}
    >
      {children}
    </Context.Provider>
  );
}
function PreviewSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loginSessionId, setLoginSessionId] = useState<string | null>(null);
  const enterPreview = useCallback(
    () => setLoginSessionId(previewLoginId()),
    [],
  );
  return (
    <Context.Provider
      value={{
        ready: true,
        available: true,
        signedIn: Boolean(loginSessionId),
        loginSessionId,
        managed: false,
        enterPreview,
        leave: async () => {
          endPreviewLogin();
          // A full navigation discards in-memory private preview state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/welcome");
        },
        manage: () => router.push("/sign-in"),
      }}
    >
      {children}
    </Context.Provider>
  );
}
function ManagedSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, session } = useSession();
  const clerk = useClerk();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setLoadingTimedOut(true), 12_000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
  const [preview, setPreview] = useState<string | null>(null);
  const enterPreview = useCallback(() => setPreview(previewLoginId()), []);
  return (
    <Context.Provider
      value={{
        ready: Boolean(isLoaded) || clerk.status === "error" || loadingTimedOut,
        available: Boolean(isLoaded) && clerk.status === "ready",
        signedIn: Boolean(isSignedIn) || Boolean(preview),
        loginSessionId: session?.id ?? preview,
        managed: Boolean(isSignedIn),
        enterPreview,
        leave: async () => {
          if (!isLoaded) throw new Error("Account session is loading");
          if (isSignedIn && session)
            await clerk.signOut({
              sessionId: session.id,
              redirectUrl: "/welcome",
            });
          setPreview(null);
          endPreviewLogin();
          if (!isSignedIn || !session) {
            // A full navigation discards in-memory private preview state.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/welcome");
          }
        },
        manage: () => {
          if (!isLoaded || clerk.status !== "ready")
            throw Error("Authentication unavailable");
          if (isSignedIn) clerk.openUserProfile();
          else router.push("/sign-in");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
