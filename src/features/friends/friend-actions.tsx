"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import type { Person } from "@/features/feed/schema";
import { friendStatus, type FriendAction } from "./model";

export function FriendActions({
  person,
  onComplete,
}: {
  person: Person;
  onComplete?: (message: string) => void;
}) {
  const { state, bootstrap, changeFriend } = usePreview();
  const relationship = friendStatus(
    bootstrap.viewerId,
    person.id,
    state.friendships,
  );
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!status || onComplete) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === document.body)
        controls.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [status, onComplete]);
  function act(action: FriendAction) {
    try {
      changeFriend(person.id, action);
      const messages: Record<FriendAction, string> = {
        send: `Friend request sent to ${person.name}.`,
        accept: `You and ${person.name} are now friends.`,
        decline: `Friend request from ${person.name} declined.`,
        cancel: `Friend request to ${person.name} cancelled.`,
        remove: `${person.name} removed from friends.`,
      };
      setError("");
      setStatus(messages[action]);
      setConfirming(false);
      onComplete?.(messages[action]);
    } catch (error) {
      setError(previewMessage(error));
    }
  }
  if (relationship === "self") return null;
  return (
    <div className="margin-friend-controls">
      <div
        ref={controls}
        className="margin-friend-buttons"
        role="group"
        aria-label={`Friendship with ${person.name}`}
      >
        {relationship === "none" && (
          <Button variant="outline" onClick={() => act("send")}>
            <UserPlus aria-hidden="true" strokeWidth={1.5} />
            Add friend
          </Button>
        )}
        {relationship === "incoming" && (
          <>
            <Button onClick={() => act("accept")}>Accept request</Button>
            <Button variant="ghost" onClick={() => act("decline")}>
              Decline
            </Button>
          </>
        )}
        {relationship === "outgoing" && (
          <>
            <span className="margin-friend-label">Request sent</span>
            <Button variant="ghost" onClick={() => act("cancel")}>
              Cancel request
            </Button>
          </>
        )}
        {relationship === "blocked" && (
          <span className="margin-friend-label">
            Friend requests unavailable
          </span>
        )}
        {relationship === "friends" && (
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogTrigger asChild>
              <Button
                ref={trigger}
                variant="outline"
                aria-label={`Manage friendship with ${person.name}`}
              >
                <Check aria-hidden="true" strokeWidth={1.5} />
                Friends
                <ChevronDown aria-hidden="true" strokeWidth={1.5} />
              </Button>
            </DialogTrigger>
            <DialogContent
              role="alertdialog"
              aria-modal="true"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                cancel.current?.focus();
              }}
              onCloseAutoFocus={(event) => {
                if (!trigger.current?.isConnected) event.preventDefault();
              }}
            >
              <DialogTitle>Remove {person.name} from friends?</DialogTitle>
              <DialogDescription>
                You’ll no longer see each other’s friend-only posts and
                photographs. Existing messages stay in your conversation
                history. You can send a new friend request later.
              </DialogDescription>
              <div className="margin-form-actions">
                <Button
                  ref={cancel}
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                >
                  Keep friend
                </Button>
                <Button onClick={() => act("remove")}>Remove friend</Button>
              </div>
              {error && (
                <p role="alert" className="margin-field-hint">
                  {error}
                </p>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
      {!onComplete && (
        <p role="status" className="margin-field-hint">
          {status}
        </p>
      )}
      {error && !confirming && (
        <p role="alert" className="margin-field-hint">
          {error}
        </p>
      )}
    </div>
  );
}
