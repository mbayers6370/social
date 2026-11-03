"use client";
import Link from "next/link";
import { useState } from "react";
import { Shield } from "@/components/margin-icons";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccountSession } from "@/components/auth/account-session";
export function AccountControls({ compact = false }: { compact?: boolean }) {
  const session = useAccountSession();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  if (!session) return null;
  if (!session.ready)
    return (
      <p className="margin-account-session-note" role="status">
        Loading account…
      </p>
    );
  if (!session.available)
    return (
      <div className="margin-account-controls">
        <p role="status">Account services are temporarily unavailable.</p>
        <Link href="/sign-in">Return to sign in</Link>
      </div>
    );
  return (
    <div
      className={
        compact ? "margin-account-menu-actions" : "margin-account-controls"
      }
    >
      {session.managed ? (
        <Button
          variant="outline"
          onClick={async () => {
            setError("");
            try {
              await session.manage();
            } catch {
              setError("Account security could not be opened. Try again.");
            }
          }}
          aria-label="Account & security"
        >
          {!compact && <Shield aria-hidden="true" />}
          {compact ? "Account" : "Account & security"}
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href="/sign-in">
            {!compact && <LogIn aria-hidden="true" />}
            Sign in
          </Link>
        </Button>
      )}
      {session.signedIn && (
        <Button
          variant="outline"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            setError("");
            try {
              await session.leave();
            } catch {
              setError("Couldn’t sign out. Try again.");
              setWorking(false);
            }
          }}
        >
          {!compact && <LogOut aria-hidden="true" />}
          {working
            ? "Signing out…"
            : session.managed
              ? "Sign out"
              : "Exit preview"}
        </Button>
      )}
      {!compact && session.managed && (
        <p className="margin-account-session-note">
          Signing out ends your session on this device.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
