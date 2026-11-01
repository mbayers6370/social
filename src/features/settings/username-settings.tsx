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
import { usePreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import {
  checkUsername,
  nextUsernameChange,
  usernameChangeDate,
  USERNAME_COOLDOWN_DAYS,
} from "@/features/profile/username";

export function UsernameSettings() {
  const preview = usePreview();
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
  const profile = preview.state.profiles.find(
    (profile) => profile.person.id === preview.bootstrap.viewerId,
  );
  if (!profile) return null;
  const next = nextUsernameChange(preview.state.usernameChangedAt);
  const locked =
    next !== null && (!Number.isFinite(next) || preview.now < next);
  const check = checkUsername(
    draft,
    preview.state.profiles,
    preview.bootstrap.viewerId,
    preview.state.usernameChangedAt,
    new Date(preview.now),
  );
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
                  ? `@${check.username} is available in this preview.`
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
        {locked && next !== null && Number.isFinite(next)
          ? `You can change your username again on ${usernameChangeDate(new Date(next).toISOString())}.`
          : `You can change your username once every ${USERNAME_COOLDOWN_DAYS} days.`}
      </p>
      <p role="status" className="margin-status">
        {status}
      </p>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
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
              Change @{profile.handle} to @{pending}? Your friends and profile
              links stay the same. You’ll need to wait {USERNAME_COOLDOWN_DAYS}{" "}
              days before changing it again.
            </DialogDescription>
          </DialogHeader>
          <div className="margin-username-actions">
            <Button
              ref={cancelConfirmation}
              variant="outline"
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pending) return;
                try {
                  preview.changeUsername(pending);
                  setStatus(`Username changed to @${pending}.`);
                  setPending(null);
                  setEditing(false);
                } catch (error) {
                  setError(previewMessage(error));
                  setPending(null);
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
