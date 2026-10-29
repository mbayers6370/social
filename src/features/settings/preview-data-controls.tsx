"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { usePreview } from "@/features/local-preview/provider";
import { createPreviewExport } from "./preview-export";
export function PreviewDataControls() {
  const preview = usePreview();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const current = downloads.current;
    return () => {
      current.forEach((timer, url) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      });
      current.clear();
    };
  }, []);
  function download() {
    try {
      const data = createPreviewExport(
        preview.state,
        preview.bootstrap.viewerId,
        preview.preferences,
        preview.interactions,
        undefined,
        preview.notifications,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        downloads.current.delete(url);
      }, 1000);
      downloads.current.set(url, timer);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "margin-preview-data.json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setError("");
      setStatus(
        "Preview download prepared. This is not a server account archive.",
      );
    } catch {
      setError("Your download couldn’t be created. Please try again.");
    }
  }
  return (
    <div className="margin-setting-summary">
      <h3>Your Data</h3>
      <div className="margin-settings-actions">
        <div className="margin-setting-action">
          <p className="margin-field-hint">
            Download this tab’s profile, local posts, gallery descriptions,
            comments, likes, friendships, selected music, notification
            preferences and reading preferences as JSON. Image files, messages
            and server account records aren’t included.
          </p>
          <Button
            variant="ghost"
            className="margin-settings-action-button"
            onClick={download}
          >
            <Download aria-hidden="true" strokeWidth={1.5} />
            Download preview data
          </Button>
          {error && <FieldError>{error}</FieldError>}
          <p role="status" className="margin-status">
            {status}
          </p>
        </div>
        <div className="margin-setting-action">
          <p className="margin-field-hint" id="account-deletion-status">
            Real account export and deletion aren’t connected. Refresh clears
            in-memory changes but does not delete saved music from the local
            database.
          </p>
          <Button
            variant="ghost"
            className="margin-settings-action-button"
            disabled
            aria-describedby="account-deletion-status"
          >
            <Trash2 aria-hidden="true" strokeWidth={1.5} />
            Delete account · Not available yet
          </Button>
        </div>
      </div>
    </div>
  );
}
