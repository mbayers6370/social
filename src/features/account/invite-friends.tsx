"use client";
import { useState } from "react";
import { Copy, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccountSession } from "@/components/auth/account-session";
export function InviteFriends() {
  const session = useAccountSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const message = () =>
    `I’d like you in my circle on Margin. A little of our days, with room for everything else. ${window.location.origin}/sign-up${code ? `\n\nYour invitation code: ${code}` : ""}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Invite a friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>A small circle starts here.</DialogTitle>
        <DialogDescription>
          {session?.managed
            ? "Create a single-use invitation from your account’s remaining allowance, then share it with someone you know. Invitations expire after seven days."
            : "Introduce a friend to Margin. Access requires an invitation code during the first release; the local preview does not issue live codes."}
        </DialogDescription>
        {session?.managed && !code && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/invitations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                const data = await response.json();
                if (!response.ok)
                  throw Error(data.error ?? "Invitation could not be created.");
                setCode(data.code);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Invitation could not be created.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create invitation"}
          </Button>
        )}
        {code && (
          <div className="margin-invitation-code">
            <span>Your friend’s code</span>
            <code>{code}</code>
          </div>
        )}
        {(!session?.managed || code) && (
          <>
            <p className="margin-invitation-message">
              I’d like you in my circle on Margin. A little of our days, with
              room for everything else.
            </p>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message());
                  setCopied(true);
                } catch {
                  setError(
                    "Copying is unavailable. Select the text and code above to share them.",
                  );
                }
              }}
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy invitation message"}
            </Button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
