"use client";
import { useSpaceClient } from "./client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { TimeZonePicker } from "./time-zone-picker";
import { EventDateTimeField } from "./event-date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eventLocalValue, eventTimeCandidates } from "./event-time";
import type { SpaceDetails } from "./contracts";
import { useSpaceAction } from "./use-space-action";

function RepeatedTime({
  candidates,
  name,
  end = false,
}: {
  candidates: string[];
  name: string;
  end?: boolean;
}) {
  const id = useId();
  if (candidates.length < 2) return null;
  return (
    <>
      <Label htmlFor={id}>
        {end ? "This end time occurs twice" : "This clock time occurs twice"}
      </Label>
      <select id={id} name={name} required defaultValue="">
        <option value="">Choose an occurrence</option>
        {candidates.map((candidate, index) => (
          <option key={candidate} value={candidate}>
            {index === 0 ? "First" : "Second"} occurrence (
            {candidate.slice(11, 16)} UTC)
          </option>
        ))}
      </select>
    </>
  );
}

export function SpaceForm({
  space,
  onSaved,
  onCancel,
}: {
  space?: SpaceDetails;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const client = useSpaceClient();
  const action = useSpaceAction();
  const [hasPlans, setHasPlans] = useState(Boolean(space?.startsAt));
  const [hasEnd, setHasEnd] = useState(Boolean(space?.endsAt));
  const [hasLocation, setHasLocation] = useState(Boolean(space?.location));
  const [location, setLocation] = useState(space?.location ?? "");
  const [rsvpEnabled, setRsvpEnabled] = useState(space?.rsvpEnabled ?? true);
  const [zone, setZone] = useState(
    space?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [local, setLocal] = useState(
    space?.startsAt && space.timeZone
      ? eventLocalValue(space.startsAt, space.timeZone)
      : "",
  );
  const [endLocal, setEndLocal] = useState(
    space?.endsAt && space.timeZone
      ? eventLocalValue(space.endsAt, space.timeZone)
      : "",
  );
  const [validation, setValidation] = useState("");
  let candidates: string[] = [];
  let endCandidates: string[] = [];
  try {
    candidates = eventTimeCandidates(local, zone);
    endCandidates = eventTimeCandidates(endLocal, zone);
  } catch {
    // Invalid wall-clock times and zones are explained on submit.
  }
  return (
    <form
      className="margin-space-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setValidation("");
        const fields = new FormData(event.currentTarget);
        let input: object = {
          kind: "PRIVATE",
          name: String(fields.get("name")),
          location: hasLocation ? location : "",
          rsvpEnabled,
        };
        if (hasPlans) {
          if (!candidates.length) {
            setValidation(
              "Check the time zone and choose a local time that exists.",
            );
            return;
          }
          const startsAt =
            candidates.length === 1
              ? candidates[0]
              : String(fields.get("occurrence") ?? "");
          if (!candidates.includes(startsAt)) {
            setValidation(
              "Choose which occurrence of this repeated clock time you mean.",
            );
            return;
          }
          let endsAt: string | undefined;
          if (hasEnd) {
            endsAt =
              endCandidates.length === 1
                ? endCandidates[0]
                : String(fields.get("endOccurrence") ?? "");
            if (!endCandidates.includes(endsAt)) {
              setValidation(
                "Choose an end time that exists, including its occurrence if the clock time repeats.",
              );
              return;
            }
            if (Date.parse(endsAt) <= Date.parse(startsAt)) {
              setValidation("The end time must be after the start time.");
              return;
            }
          }
          input = {
            ...input,
            startsAt,
            timeZone: zone,
            ...(endsAt ? { endsAt } : {}),
          };
        }
        const saved = await action.run(
          space ? `/api/spaces/${space.id}` : "/api/spaces",
          space ? "PATCH" : "POST",
          input,
          !space,
        );
        if (saved) {
          if (space) onSaved?.();
          else router.push(client.href(`/app/spaces/${saved.id}`));
        }
      }}
    >
      <Label htmlFor={`${id}-name`}>Space name</Label>
      <Input
        id={`${id}-name`}
        name="name"
        defaultValue={space?.name}
        required
        maxLength={100}
        disabled={action.busy}
      />
      <Button
        variant="outline"
        disabled={action.busy}
        aria-expanded={hasPlans}
        aria-controls={`${id}-plans`}
        onClick={() => setHasPlans((current) => !current)}
      >
        {hasPlans ? "Remove date and time" : "Add a date and time"}
      </Button>
      {!hasPlans && space?.startsAt && (
        <p className="margin-field-hint">
          The dates, times and RSVPs will be removed when you save. Your Space,
          location and posts stay.
        </p>
      )}
      {hasPlans && (
        <fieldset
          id={`${id}-plans`}
          className="margin-space-plan-fields"
          disabled={action.busy}
        >
          <legend className="sr-only">Date and time</legend>
          <EventDateTimeField value={local} onChange={setLocal} />
          <Label htmlFor={`${id}-zone`}>Time zone</Label>
          <TimeZonePicker id={`${id}-zone`} value={zone} onChange={setZone} />
          <RepeatedTime candidates={candidates} name="occurrence" />
          <label className="margin-space-preference">
            <input
              type="checkbox"
              checked={hasEnd}
              onChange={(event) => setHasEnd(event.target.checked)}
            />
            <span>Set an end time</span>
          </label>
          {hasEnd && (
            <>
              <EventDateTimeField end value={endLocal} onChange={setEndLocal} />
              <RepeatedTime
                end
                candidates={endCandidates}
                name="endOccurrence"
              />
            </>
          )}
          <label className="margin-space-preference">
            <input
              type="checkbox"
              checked={rsvpEnabled}
              onChange={(event) => setRsvpEnabled(event.target.checked)}
            />
            <span>Allow RSVPs</span>
          </label>
          {!rsvpEnabled && space && (
            <p className="margin-field-hint">
              Existing responses stay saved while RSVPs are off.
            </p>
          )}
        </fieldset>
      )}
      <label className="margin-space-preference">
        <input
          type="checkbox"
          checked={hasLocation}
          disabled={action.busy}
          onChange={(event) => setHasLocation(event.target.checked)}
        />
        <span>Show a location</span>
      </label>
      {hasLocation && (
        <>
          <Label htmlFor={`${id}-location`}>Location</Label>
          <Input
            id={`${id}-location`}
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            required
            maxLength={300}
            disabled={action.busy}
          />
        </>
      )}
      {(validation || action.error) && (
        <p role="alert">{validation || action.error}</p>
      )}
      {action.uncertain && (
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload to check saved changes
        </Button>
      )}
      <div className="margin-space-form-footer">
        {onCancel && (
          <Button variant="outline" disabled={action.busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={action.busy || action.uncertain}>
          {action.busy ? "Saving…" : space ? "Save changes" : "Create Space"}
        </Button>
      </div>
    </form>
  );
}
