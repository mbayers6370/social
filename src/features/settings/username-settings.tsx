"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import { checkUsername } from "@/features/profile/username";

export function UsernameSettings({
  account,
}: {
  account?: {
    id: string;
    username: string;
    usernameChangedAt: string | null;
    onChange: (value: string) => Promise<void>;
  };
} = {}) {
  const preview = useOptionalPreview();
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const cancelConfirmation = useRef<HTMLButtonElement>(null);
  const currentUsername = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const profile = account
    ? { person: { id: account.id }, handle: account.username }
    : preview?.state.profiles.find(
        (profile) => profile.person.id === preview.bootstrap.viewerId,
      );
  const changedAt = account
    ? account.usernameChangedAt
    : preview?.state.usernameChangedAt;
  const [mountedAt] = useState(() => Date.now());
  const now = preview?.now ?? mountedAt;
  const locked = changedAt != null;
  const check = checkUsername(
    draft,
    account
      ? [{ person: { id: account.id }, handle: account.username }]
      : (preview?.state.profiles ?? []),
    account?.id ?? preview?.bootstrap.viewerId ?? "",
    changedAt ?? undefined,
    new Date(now),
  );
  if (!profile) return null;
  const validationError =
    error || (touched && !check.available ? check.message : "");
  function cancelEditing() {
    setEditing(false);
    setError("");
    requestAnimationFrame(() => changeButton.current?.focus());
  }
  return (
    <div className="margin-setting-summary margin-username-settings">
      <h3>Username</h3>
      <p
        ref={currentUsername}
        tabIndex={-1}
        className="margin-username-current"
      >
        @{profile.handle}
      </p>
      {editing ? (
        <form
          aria-label="Change username"
          noValidate
          className="margin-username-form"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (check.available) setPending(check.username);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
        >
          <Field>
            <Label htmlFor="settings-username">New username</Label>
            <Input
              id="settings-username"
              ref={input}
              value={draft}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              maxLength={25}
              aria-invalid={Boolean(validationError)}
              aria-describedby="username-rules username-result"
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onBlur={() => setTouched(true)}
            />
            <p id="username-rules" className="margin-field-hint">
              3–24 letters, numbers or underscores. Start with a letter.
              Uppercase letters become lowercase.
            </p>
            {validationError ? (
              <FieldError id="username-result">{validationError}</FieldError>
            ) : (
              <p
                id="username-result"
                role="status"
                className="margin-field-hint"
              >
                {check.available
                  ? account
                    ? `@${check.username} will be checked when you confirm.`
                    : `@${check.username} is available in this preview.`
                  : ""}
              </p>
            )}
          </Field>
          <div className="margin-username-actions">
            <Button variant="outline" onClick={cancelEditing}>
              Cancel
            </Button>
            <Button
              ref={reviewButton}
              type="submit"
              disabled={!check.available}
            >
              Review change
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={changeButton}
          variant="ghost"
          className="margin-username-change"
          disabled={locked}
          onClick={() => {
            setDraft(profile.handle);
            setTouched(false);
            setError("");
            setStatus("");
            setEditing(true);
          }}
        >
          Change username
        </Button>
      )}
      <p className="margin-field-hint">
        {locked
          ? "Your one username change has been used."
          : "You can change your username once. After that, it’s permanent."}
      </p>
      <p role="status" className="margin-status">
        {status}
      </p>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !working) setPending(null);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelConfirmation.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target =
              reviewButton.current && !reviewButton.current.disabled
                ? reviewButton.current
                : currentUsername.current;
            target?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>Change username?</DialogTitle>
            <DialogDescription>
              Change @{profile.handle} to @{pending}? Your friends stay the
              same, but your shareable profile link changes. This is your only
              username change; you cannot change it again.
            </DialogDescription>
          </DialogHeader>
          <div className="margin-username-actions">
            <Button
              ref={cancelConfirmation}
              variant="outline"
              disabled={working}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={working}
              onClick={async () => {
                if (!pending || working) return;
                setWorking(true);
                try {
                  if (account) await account.onChange(pending);
                  else preview?.changeUsername(pending);
                  setStatus(`Username changed to @${pending}.`);
                  setPending(null);
                  setEditing(false);
                } catch (error) {
                  setError(
                    account && error instanceof Error
                      ? error.message
                      : previewMessage(error),
                  );
                  setPending(null);
                } finally {
                  setWorking(false);
                }
              }}
            >
              Confirm change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
