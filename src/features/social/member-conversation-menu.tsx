"use client";
import { useRef, useState } from "react";
import { Download, Flag, Trash } from "@/components/margin-icons";
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
  const [panel, setPanel] = useState<"clear" | "download-error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (menuTrigger.current?.isConnected)
      menuTrigger.current.focus({ preventScroll: true });
  };
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await requestMember(
        client,
        `/api/messages/${encodeURIComponent(data.thread.id)}/export`,
      );
      const href = URL.createObjectURL(
        new Blob([JSON.stringify(saved, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = data.thread.notebook
        ? "margin-notebook.json"
        : "margin-conversation.json";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
      setStatus("Your conversation download is ready.");
      setPanel(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t download this conversation.",
      );
      setPanel("download-error");
    } finally {
      setBusy(false);
    }
  }
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
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                void download();
              }}
            >
              <Download aria-hidden="true" />
              {data.thread.notebook
                ? "Download notes"
                : "Download conversation"}
            </Button>
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
                setPanel("clear");
              }}
            >
              <Trash aria-hidden="true" />
              {data.thread.notebook ? "Delete notes" : "Clear my history"}
            </Button>
          </>
        }
      />
      <p role="status" className="sr-only">
        {busy ? "Working…" : status}
      </p>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPanel(null);
        }}
      >
        <DialogContent
          role={panel === "clear" ? "alertdialog" : "dialog"}
          showCloseButton={!busy}
          onCloseAutoFocus={restoreFocus}
        >
          <DialogTitle>
            {panel === "download-error"
              ? "Your download couldn’t be prepared"
              : data.thread.notebook
                ? "Delete your notes?"
                : "Clear your conversation?"}
          </DialogTitle>
          <DialogDescription>
            {panel === "download-error"
              ? "Your saved messages remain in your account. Please try again."
              : data.thread.notebook
                ? "This permanently deletes your saved Notebook entries."
                : "This removes your copy of the conversation history. The other member keeps their copy. New messages can still arrive while you’re friends."}
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <div className="margin-form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPanel(null)}
            >
              Cancel
            </Button>
            <Button
              variant={panel === "clear" ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                if (panel === "download-error") return download();
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
                  setPanel(null);
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
              {panel === "download-error"
                ? "Try again"
                : data.thread.notebook
                  ? "Delete notes"
                  : "Clear my history"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
