"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

type Session = {
  ready: boolean;
  signedIn: boolean;
  managed: boolean;
  enterPreview: () => void;
  leave: () => Promise<void>;
  manage: () => void;
};
const Context = createContext<Session | null>(null);
export function useAccountSession() {
  return useContext(Context);
}
export function AccountSession({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return enabled ? (
    <ManagedSession>{children}</ManagedSession>
  ) : (
    <PreviewSession>{children}</PreviewSession>
  );
}
function PreviewSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const enterPreview = useCallback(() => setSignedIn(true), []);
  return (
    <Context.Provider
      value={{
        ready: true,
        signedIn,
        managed: false,
        enterPreview,
        leave: async () => {
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
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const [preview, setPreview] = useState(false);
  const enterPreview = useCallback(() => setPreview(true), []);
  return (
    <Context.Provider
      value={{
        ready: Boolean(isLoaded),
        signedIn: Boolean(isSignedIn) || preview,
        managed: Boolean(isSignedIn),
        enterPreview,
        leave: async () => {
          if (!isLoaded) throw new Error("Account session is loading");
          if (isSignedIn) await clerk.signOut({ redirectUrl: "/welcome" });
          else {
            // A full navigation discards in-memory private preview state.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/welcome");
          }
        },
        manage: () => {
          if (!isLoaded) return;
          if (isSignedIn) clerk.openUserProfile();
          else router.push("/sign-in");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
