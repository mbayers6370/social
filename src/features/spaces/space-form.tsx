"use client";
import { useSpaceClient } from "./client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Gathering, Check } from "@/components/margin-icons";
import { TimeZonePicker } from "./time-zone-picker";
import { EventDateTimeField } from "./event-date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eventLocalValue, eventTimeCandidates } from "./event-time";
import type { SpaceDetails } from "./contracts";
import { useSpaceAction } from "./use-space-action";
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
  const [kind, setKind] = useState<"PRIVATE" | "GATHERING">(
    space?.kind === "GATHERING" ? "GATHERING" : "PRIVATE",
  );
  const [zone, setZone] = useState(
    space?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [local, setLocal] = useState(
    space?.startsAt && space.timeZone
      ? eventLocalValue(space.startsAt, space.timeZone)
      : "",
  );
  const [validation, setValidation] = useState("");
  let candidates: string[] = [];
  try {
    candidates = eventTimeCandidates(local, zone);
  } catch {
    /* Invalid zones are explained on submit. */
  }
  return (
    <form
      className="margin-space-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setValidation("");
        const f = new FormData(e.currentTarget);
        let input: object = { kind, name: String(f.get("name")) };
        if (kind === "GATHERING") {
          if (!candidates.length) {
            setValidation(
              "Check the time zone and choose a local time that exists.",
            );
            return;
          }
          const startsAt =
            candidates.length === 1
              ? candidates[0]
              : String(f.get("occurrence") ?? "");
          if (!candidates.includes(startsAt)) {
            setValidation(
              "Choose which occurrence of this repeated clock time you mean.",
            );
            return;
          }
          input = {
            ...input,
            startsAt,
            timeZone: zone,
            location: String(f.get("location") ?? ""),
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
      <fieldset
        className="margin-space-kind-field"
        disabled={Boolean(space) || action.busy}
      >
        <legend className="margin-field-label">Type of Space</legend>
        <div className="margin-space-kinds">
          {(
            [
              {
                value: "PRIVATE",
                label: "Private Space",
                description: "An invitation-only place for your people.",
                Icon: Lock,
              },
              {
                value: "GATHERING",
                label: "Gathering Space",
                description: "Private plans with a date and time.",
                Icon: Gathering,
              },
            ] as const
          ).map(({ value, label, description, Icon }) => (
            <label className="margin-space-kind" key={value}>
              <input
                type="radio"
                className="sr-only"
                name={`${id}-kind`}
                value={value}
                aria-label={label}
                checked={kind === value}
                onChange={() => setKind(value)}
                aria-describedby={`${id}-${value}-hint`}
              />
              <span className="margin-space-kind-option">
                <Icon size={22} aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <span id={`${id}-${value}-hint`}>{description}</span>
                </span>
                <Check
                  size={18}
                  className="margin-space-kind-check"
                  aria-hidden="true"
                />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "GATHERING" && !space && (
        <p className="margin-field-hint">
          Gathering Spaces are invitation-only. Public events are in Find an
          Event Space.
        </p>
      )}
      <Label htmlFor={`${id}-name`}>
        {kind === "GATHERING" ? "Gathering Space name" : "Space name"}
      </Label>
      <Input
        id={`${id}-name`}
        name="name"
        defaultValue={space?.name}
        required
        maxLength={100}
      />
      {kind === "GATHERING" && (
        <>
          <EventDateTimeField value={local} onChange={setLocal} />
          <Label htmlFor={`${id}-zone`}>Time zone</Label>
          <TimeZonePicker id={`${id}-zone`} value={zone} onChange={setZone} />
          {candidates.length > 1 && (
            <>
              <Label htmlFor={`${id}-occurrence`}>
                This clock time occurs twice
              </Label>
              <select
                id={`${id}-occurrence`}
                name="occurrence"
                required
                defaultValue=""
              >
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
          <Label htmlFor={`${id}-location`}>Location (optional)</Label>
          <Input
            id={`${id}-location`}
            name="location"
            defaultValue={space?.location ?? ""}
            maxLength={300}
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
