import type { SpaceSummary } from "./contracts";

/** Directory and discovery cards share the same event lifecycle labels. */
export function SpaceDates({
  space,
  detailed = false,
}: {
  space: SpaceSummary;
  detailed?: boolean;
}) {
  if (!space.startsAt) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: space.timeZone!,
  });
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: space.timeZone!,
  });
  const start = detailed
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: space.timeZone!,
      })
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(year.format(new Date(space.startsAt)) !== year.format(new Date())
          ? { year: "numeric" }
          : {}),
        timeZone: space.timeZone!,
      });
  return (
    <span className="margin-space-date">
      <span>
        {space.kind === "EVENT" ? "Event " : ""}
        <time dateTime={space.startsAt}>
          {detailed
            ? start.format(new Date(space.startsAt))
            : start.format(new Date(space.startsAt)).replace(",", "")}
        </time>
      </span>
      {space.kind === "EVENT" && space.expiresAt && (
        <span>
          Disappears{" "}
          <time dateTime={space.expiresAt}>
            {date.format(new Date(space.expiresAt))}
          </time>{" "}
          · 48 hours after the event ends
        </span>
      )}
    </span>
  );
}
