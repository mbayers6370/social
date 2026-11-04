"use client";
import { Button } from "@/components/ui/button";
import type { SpaceDetails } from "./contracts";
import { useSpaceAction } from "./use-space-action";

const responses = [
  { value: "GOING", label: "Going" },
  { value: "MAYBE", label: "Maybe" },
  { value: "DECLINED", label: "Can’t go" },
] as const;

export function SpaceRsvp({ data }: { data: SpaceDetails }) {
  const action = useSpaceAction();
  if (!data.startsAt || data.rsvpEnabled === false) return null;
  const disabled = action.busy || Boolean(data.archivedAt);
  function respond(rsvp: SpaceDetails["rsvp"]) {
    return action.run(`/api/spaces/${data.id}/members`, "PATCH", {
      action: "rsvp",
      rsvp,
    });
  }
  return (
    <fieldset className="margin-space-rsvp" disabled={disabled}>
      <legend>Your RSVP</legend>
      <div className="margin-space-rsvp-choices">
        {responses.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            className="margin-space-rsvp-choice"
            aria-pressed={data.rsvp === value}
            onClick={() => respond(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {data.rsvp && (
        <Button
          type="button"
          variant="ghost"
          className="margin-space-rsvp-clear"
          onClick={() => respond(null)}
        >
          Clear response
        </Button>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </fieldset>
  );
}
