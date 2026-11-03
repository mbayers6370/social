"use client";
import { useEffect, useRef, useState } from "react";
import { Friends, ChevronDown, AddFriend } from "@/components/margin-icons";
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
import { useFriendFeedback } from "./use-friend-feedback";
import { friendStatus, type FriendAction } from "./model";

type FriendControlsProps = {
  person: Person;
  onComplete?: (message: string) => void;
  onStatusChange?: (message: string) => void;
  compact?: boolean;
};
export function FriendActions(props: FriendControlsProps) {
  const { state, bootstrap, changeFriend } = usePreview();
  return (
    <FriendControls
      {...props}
      relationship={friendStatus(
        bootstrap.viewerId,
        props.person.id,
        state.friendships,
      )}
      changeFriend={changeFriend}
    />
  );
}
export function FriendControls({
  person,
  onComplete,
  onStatusChange,
  compact = false,
  relationship,
  changeFriend,
  live = false,
}: FriendControlsProps & {
  relationship: ReturnType<typeof friendStatus>;
  changeFriend: (
    personId: string,
    action: FriendAction,
  ) => void | Promise<void>;
  live?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useFriendFeedback();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
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
  async function act(action: FriendAction) {
    try {
      const completion = changeFriend(person.id, action);
      if (completion) {
        setWorking(true);
        await completion;
      }
      const messages: Record<FriendAction, string> = {
        send: `Friend request sent to ${person.name}.`,
        accept: `You and ${person.name} are now friends.`,
        decline: `Friend request from ${person.name} declined.`,
        cancel: `Friend request to ${person.name} cancelled.`,
        remove: `${person.name} removed from friends.`,
        block: live
          ? `${person.name} blocked.`
          : `${person.name} blocked in this preview.`,
        unblock: live
          ? `${person.name} unblocked.`
          : `${person.name} unblocked in this preview.`,
      };
      setError("");
      setStatus(messages[action]);
      setConfirming(false);
      onComplete?.(messages[action]);
      onStatusChange?.(messages[action]);
    } catch (error) {
      setError(
        live && error instanceof Error ? error.message : previewMessage(error),
      );
    } finally {
      setWorking(false);
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
          <Button
            variant="outline"
            size={compact ? "icon" : "default"}
            aria-label={compact ? "Add friend" : undefined}
            title={compact ? "Add friend" : undefined}
            disabled={working}
            onClick={() => act("send")}
          >
            <AddFriend aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Add friend</span>
          </Button>
        )}
        {relationship === "incoming" && (
          <>
            <Button
              disabled={working}
              aria-busy={working || undefined}
              onClick={() => act("accept")}
            >
              {working ? "Accepting…" : "Accept request"}
            </Button>
            <Button
              variant={compact ? "outline" : "ghost"}
              disabled={working}
              onClick={() => act("decline")}
            >
              Decline
            </Button>
          </>
        )}
        {relationship === "outgoing" && (
          <>
            <span className="margin-friend-label margin-friend-request-status">
              Request sent
            </span>
            <Button
              variant="outline"
              disabled={working}
              onClick={() => act("cancel")}
            >
              Cancel request
            </Button>
          </>
        )}
        {relationship === "blocked" && (
          <span className="margin-friend-label">
            Friend requests unavailable
          </span>
        )}
        {relationship === "friends" && compact && (
          <span
            className="margin-profile-friend-status"
            role="img"
            aria-label={`Friends with ${person.name}`}
            title="Friends"
          >
            <Friends aria-hidden="true" />
            <span>Friends</span>
          </span>
        )}
        {relationship === "friends" && !compact && (
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogTrigger asChild>
              <Button
                ref={trigger}
                variant="outline"
                aria-label={`Manage friendship with ${person.name}`}
              >
                <Friends className="margin-friends-icon" aria-hidden="true" />
                Friends
                <ChevronDown aria-hidden="true" />
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
                  Cancel
                </Button>
                <Button disabled={working} onClick={() => act("remove")}>
                  Remove friend
                </Button>
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
      {!onComplete && !onStatusChange && (
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
