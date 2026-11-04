"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SpaceDetails as Data } from "./contracts";
import { SpaceForm } from "./space-form";
import { useSpaceAction } from "./use-space-action";
import { preserveTimeZoneMenu } from "./time-zone-picker";
import { EventEndDialog } from "./event-end-dialog";
export function SpaceSettings({ data }: { data: Data }) {
  const action = useSpaceAction();
  const [edit, setEdit] = useState(false);
  const [archive, setArchive] = useState(false);
  if (data.role !== "ADMIN" || data.archivedAt) return null;
  if (data.kind === "EVENT")
    return (
      <div className="margin-space-settings">
        <label className="margin-space-preference">
          <input
            type="checkbox"
            checked={data.rsvpEnabled !== false}
            disabled={action.busy}
            onChange={(event) =>
              action.run(`/api/spaces/${data.id}/members`, "PATCH", {
                action: "rsvp-settings",
                rsvpEnabled: event.target.checked,
              })
            }
          />
          <span>Allow RSVPs</span>
        </label>
        {action.error && !edit && <p role="alert">{action.error}</p>}
        <Button variant="outline" onClick={() => setEdit(true)}>
          Edit end time
        </Button>
        {edit && (
          <EventEndDialog
            event={data}
            busy={action.busy}
            error={action.error}
            onClose={() => setEdit(false)}
            onSave={async (endsAt) => {
              if (
                await action.run(`/api/spaces/${data.id}/schedule`, "PATCH", {
                  endsAt,
                })
              )
                setEdit(false);
            }}
          />
        )}
      </div>
    );
  return (
    <div className="margin-space-settings">
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogTrigger asChild>
          <Button variant="outline">Edit details</Button>
        </DialogTrigger>
        <DialogContent onEscapeKeyDown={preserveTimeZoneMenu}>
          <DialogTitle>Edit Space details</DialogTitle>
          <DialogDescription>
            Change the name, dates and times, location, and RSVP options.
          </DialogDescription>
          <SpaceForm
            space={data}
            onSaved={() => setEdit(false)}
            onCancel={() => setEdit(false)}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={archive} onOpenChange={setArchive}>
        <DialogTrigger asChild>
          <Button variant="ghost">Archive Space</Button>
        </DialogTrigger>
        <DialogContent role="alertdialog">
          <DialogTitle>Archive this Space?</DialogTitle>
          <DialogDescription>
            It becomes read-only. Its details stay, while posts and comments
            still expire after 30 days.
          </DialogDescription>
          <Button variant="outline" onClick={() => setArchive(false)}>
            Cancel
          </Button>
          <Button
            disabled={action.busy}
            onClick={async () => {
              if (await action.run(`/api/spaces/${data.id}/archive`, "POST"))
                setArchive(false);
            }}
          >
            Archive Space
          </Button>
          {action.error && <p role="alert">{action.error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
