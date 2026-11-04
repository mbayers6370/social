"use client";

import { useState } from "react";
import { useSpaceClient } from "@/features/spaces/client";
import { requestMember } from "./member-client";

export function MemberConversationExport({ threadId }: { threadId: string }) {
  const client = useSpaceClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await requestMember(
        client,
        `/api/messages/${encodeURIComponent(threadId)}/export`,
      );
      const href = URL.createObjectURL(
        new Blob([JSON.stringify(saved, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "margin-conversation.json";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
      setStatus("Your conversation download is ready.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t export this conversation. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="margin-message-export"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Preparing export…" : "Export conversation"}
      </button>
      <span role="status" className="sr-only">
        {status}
      </span>
      {error && <span role="alert"> {error}</span>}
    </>
  );
}
