"use client";
import { useId, useState } from "react";
import { Flag } from "lucide-react";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import { reportReasons, type ReportInput } from "./model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function SafetyReportButton({
  target,
}: {
  target: ReportInput["target"];
}) {
  const preview = useOptionalPreview();
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  if (!preview || target.personId === preview.bootstrap.viewerId) return null;
  return (
    <>
      <span
        className="margin-report-control"
        onPointerEnter={() => {
          if (!open) setTooltip(true);
        }}
        onPointerLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement))
            setTooltip(false);
        }}
        onFocusCapture={() => {
          if (!open) setTooltip(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setTooltip(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && tooltip) {
            event.preventDefault();
            event.stopPropagation();
            setTooltip(false);
          }
        }}
      >
        <Button
          variant="ghost"
          className="margin-report-button"
          aria-label={`Report ${target.kind}`}
          aria-describedby={tooltip ? `${id}-tooltip` : undefined}
          size="icon"
          onClick={() => {
            setTooltip(false);
            setOpen(true);
            setSaved(false);
            setError("");
          }}
        >
          <Flag aria-hidden="true" />
        </Button>
        {tooltip && (
          <span
            id={`${id}-tooltip`}
            role="tooltip"
            className="margin-report-tooltip"
          >
            Report {target.kind}
          </span>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>
            {saved ? "Report saved" : `Report ${target.kind}`}
          </DialogTitle>
          <DialogDescription>
            {saved
              ? "Saved in this tab and included in your account download. Live moderation is not connected in the preview."
              : `About ${target.label}. Include only information needed to understand the concern. Do not include passwords or unrelated private information.`}
          </DialogDescription>
          {!saved && (
            <form
              className="margin-safety-report-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  preview.submitReport({
                    target,
                    reason: String(data.get("reason")) as ReportInput["reason"],
                    details: String(data.get("details") ?? ""),
                  });
                  setSaved(true);
                } catch (error) {
                  setError(previewMessage(error));
                }
              }}
            >
              <label htmlFor={`${id}-reason`}>Reason</label>
              <select
                id={`${id}-reason`}
                name="reason"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a reason
                </option>
                {reportReasons.map((reason) => (
                  <option value={reason.value} key={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`${id}-details`}>Details (optional)</label>
              <textarea
                id={`${id}-details`}
                name="details"
                rows={4}
                maxLength={1000}
              />
              {error && <p role="alert">{error}</p>}
              <div className="margin-form-actions">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save report</Button>
              </div>
            </form>
          )}
          {saved && <Button onClick={() => setOpen(false)}>Done</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
}
