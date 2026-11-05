"use client";
import { useState } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** Real account action only. Never mount in the fictional preview. */
export function AccountErasureControl() {
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const erase = useReverification(() =>
    fetch("/api/account/erasure", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
      signal: AbortSignal.timeout(30_000),
    }),
  );
  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setConfirmation("");
          setError("");
          setOpen(true);
        }}
      >
        Delete account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!working && !accepted) setOpen(value);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={!working && !accepted}
        >
          <DialogTitle>
            {accepted
              ? "Your deletion request was accepted."
              : "Permanently delete your account?"}
          </DialogTitle>
          <DialogDescription>
            {accepted
              ? "Your Margin access has ended. Deletion of your account data, photographs and sign-in identity will continue in the background. You can contact support@margin.social if you need help."
              : "This cannot be undone. Access ends immediately. We then delete your profile, posts, comments, messages, photographs, invitations and sign-in identity. Shared Spaces pass to another active member when possible. Download anything you want to keep first."}
          </DialogDescription>
          {!accepted && (
            <>
              <p className="margin-field-hint">
                A minimal deletion receipt remains for 90 days to prevent
                restored backups from reviving your account. Backups expire
                within 30 days under the launch retention plan. Copies other
                people saved are outside Margin’s control.
              </p>
              <Label htmlFor="account-erasure-confirmation">
                Type DELETE to continue
              </Label>
              <Input
                id="account-erasure-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={working}
                autoComplete="off"
              />
            </>
          )}
          <div className="margin-form-actions">
            {!accepted && (
              <Button
                variant="outline"
                disabled={working}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            )}
            <Button
              variant={accepted ? "outline" : "destructive"}
              disabled={working || (!accepted && confirmation !== "DELETE")}
              onClick={async () => {
                setWorking(true);
                setError("");
                try {
                  if (!accepted) {
                    const response = await erase();
                    if (!response) return;
                    const data = await response.json().catch(() => null);
                    if (!response.ok)
                      throw Error(
                        data?.error ??
                          "Deletion could not be confirmed. Retry or contact support@margin.social.",
                      );
                    setAccepted(true);
                  }
                  await clerk.signOut({ redirectUrl: "/your-data" });
                } catch (error) {
                  if (!isReverificationCancelledError(error))
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Deletion could not be confirmed. Retry or contact support@margin.social.",
                    );
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working
                ? "Please wait…"
                : accepted
                  ? "Sign out"
                  : "Delete my account"}
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
