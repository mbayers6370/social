"use client";
import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eventTimeCandidates, eventLocalValue } from "./event-time";
import type { SpaceSummary } from "./contracts";

export function EventEndDialog({
  event,
  busy,
  error,
  onClose,
  onSave,
}: {
  event: SpaceSummary;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (endsAt: string) => Promise<void>;
}) {
  const id = useId();
  const [local, setLocal] = useState(() =>
    event.endsAt && event.timeZone
      ? eventLocalValue(event.endsAt, event.timeZone)
      : "",
  );
  const [validation, setValidation] = useState("");
  const candidates =
    local && event.timeZone ? eventTimeCandidates(local, event.timeZone) : [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Edit event end time</DialogTitle>
        <DialogDescription>
          Events last four hours by default. Update the end time for{" "}
          {event.name}; access to this Space ends 48 hours afterward. Times are
          in {event.timeZone?.replaceAll("_", " ")}.
        </DialogDescription>
        <form
          className="margin-space-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const end =
              candidates.length === 1
                ? candidates[0]
                : String(new FormData(e.currentTarget).get("occurrence") ?? "");
            if (
              !end ||
              !candidates.includes(end) ||
              Date.parse(end) <= Date.parse(event.startsAt!) ||
              Date.parse(end) > Date.parse(event.startsAt!) + 30 * 86400_000
            ) {
              setValidation(
                "Choose a valid end time after the start and within 30 days.",
              );
              return;
            }
            await onSave(end);
          }}
        >
          <Label htmlFor={`${id}-end`}>Scheduled end</Label>
          <Input
            id={`${id}-end`}
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            required
            disabled={busy}
          />
          {candidates.length > 1 && (
            <>
              <Label htmlFor={`${id}-occurrence`}>Which occurrence?</Label>
              <select id={`${id}-occurrence`} name="occurrence" required>
                <option value="">Choose an occurrence</option>
                {candidates.map((c, i) => (
                  <option key={c} value={c}>
                    {i === 0 ? "First" : "Second"} occurrence ({c.slice(11, 16)}{" "}
                    UTC)
                  </option>
                ))}
              </select>
            </>
          )}
          {(validation || error) && <p role="alert">{validation || error}</p>}
          <div className="margin-space-form-footer">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
