"use client";
import { useId, useState, type ReactElement, type ComponentProps } from "react";
import { Flag } from "@/components/margin-icons";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import { reportReasons, type ReportInput } from "./model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
export function SafetyReportButton({
  target,
  trigger,
  onCloseAutoFocus,
  onReport,
  viewerId,
  local = true,
}: {
  target: ReportInput["target"];
  trigger?: ReactElement;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  onReport?: (input: ReportInput) => Promise<unknown>;
  viewerId?: string;
  local?: boolean;
}) {
  const preview = useOptionalPreview();
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (
    (!preview && !onReport) ||
    target.personId === (viewerId ?? preview?.bootstrap.viewerId)
  )
    return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) {
          setTooltip(false);
          setSaved(false);
          setError("");
        }
      }}
    >
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
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
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="margin-report-button"
              aria-label={`Report ${target.kind}`}
              aria-describedby={tooltip ? `${id}-tooltip` : undefined}
              size="icon"
            >
              <Flag aria-hidden="true" />
            </Button>
          </DialogTrigger>
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
      )}
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!busy}
      >
        <DialogTitle>
          {saved
            ? local
              ? "Report saved"
              : "Report submitted"
            : `Report ${target.kind}`}
        </DialogTitle>
        <DialogDescription>
          {saved
            ? local
              ? "Saved in this tab and included in your account download. Live moderation is not connected in the preview."
              : "Your report has been recorded for review."
            : `About ${target.label}. ${local ? "" : "A founder can review the reported item and its attached photographs. "}Include only information needed to understand the concern. Do not include passwords or unrelated private information.`}
        </DialogDescription>
        {!saved && (
          <form
            className="margin-safety-report-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              const data = new FormData(event.currentTarget);
              try {
                const input: ReportInput = {
                  target,
                  reason: String(data.get("reason")) as ReportInput["reason"],
                  details: String(data.get("details") ?? ""),
                };
                if (onReport) await onReport(input);
                else preview!.submitReport(input);
                setSaved(true);
              } catch (error) {
                setError(
                  onReport && error instanceof Error
                    ? error.message
                    : previewMessage(error),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor={`${id}-reason`}>Reason</label>
            <select
              id={`${id}-reason`}
              name="reason"
              required
              defaultValue=""
              disabled={busy}
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
              disabled={busy}
            />
            {error && <p role="alert">{error}</p>}
            <div className="margin-form-actions">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : local ? "Save report" : "Submit report"}
              </Button>
            </div>
          </form>
        )}
        {saved && <Button onClick={() => setOpen(false)}>Done</Button>}
      </DialogContent>
    </Dialog>
  );
}
