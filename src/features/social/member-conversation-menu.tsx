"use client";
import { useRef, useState } from "react";
import { Flag, Trash } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConversationActions } from "@/features/messages/conversation-actions";
import { SafetyReportButton } from "@/features/safety/report-button";
import { useSpaceClient } from "@/features/spaces/client";
import { memberJson, requestMember, memberChanged } from "./member-client";
import type { MemberConversation } from "./member-contracts";
import { useMember } from "./member-provider";

export function MemberConversationMenu({
  data,
  onCleared,
}: {
  data: MemberConversation;
  onCleared: () => Promise<void>;
}) {
  const client = useSpaceClient();
  const member = useMember();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (menuTrigger.current?.isConnected)
      menuTrigger.current.focus({ preventScroll: true });
  };
  return (
    <>
      <ConversationActions
        thread={{
          id: data.thread.id,
          contact: data.thread.contact,
          unread: data.thread.unread,
          messages: data.messages,
        }}
        triggerRef={menuTrigger}
        actions={
          <>
            {!data.thread.notebook && data.messages.length > 0 && (
              <SafetyReportButton
                local={false}
                viewerId={member?.identity.person.id}
                target={{
                  kind: "message",
                  id: data.messages.at(-1)!.id,
                  personId: data.thread.contact.id,
                  label: `Conversation with ${data.thread.contact.name}`,
                }}
                onCloseAutoFocus={restoreFocus}
                onReport={async (input) => {
                  await requestMember(
                    client,
                    "/api/reports",
                    memberJson("POST", input),
                  );
                  memberChanged();
                }}
                trigger={
                  <Button variant="ghost">
                    <Flag aria-hidden="true" />
                    Report conversation
                  </Button>
                }
              />
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setError("");
                setConfirming(true);
              }}
            >
              <Trash aria-hidden="true" />
              {data.thread.notebook ? "Delete notes" : "Clear my history"}
            </Button>
          </>
        }
      />
      <p role="status" className="sr-only">
        {busy ? "Working…" : ""}
      </p>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={!busy}
          onCloseAutoFocus={restoreFocus}
        >
          <DialogTitle>
            {data.thread.notebook
              ? "Delete your notes?"
              : "Clear your conversation?"}
          </DialogTitle>
          <DialogDescription>
            {data.thread.notebook
              ? "This permanently deletes your saved Notebook entries."
              : "This removes your copy of the conversation history. The other member keeps their copy. New messages can still arrive while you’re friends."}
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <div className="margin-form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await requestMember(
                    client,
                    `/api/messages/${encodeURIComponent(data.thread.id)}`,
                    { method: "DELETE" },
                  );
                  memberChanged();
                  await onCleared();
                  setConfirming(false);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t clear this conversation. Reload before trying again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {data.thread.notebook ? "Delete notes" : "Clear my history"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
