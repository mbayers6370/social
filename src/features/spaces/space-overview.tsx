"use client";
import { Calendar, Pin } from "@/components/margin-icons";
import type { SpaceDetails } from "./contracts";

/** Everyday context belongs beside the identity, outside administration. */
export function SpaceOverview({ data }: { data: SpaceDetails }) {
  if (data.kind === "PRIVATE") return null;
  return (
    <section
      className="margin-space-overview"
      aria-label="Gathering and event details"
    >
      <div className="margin-space-event-facts">
        {data.startsAt && (
          <p className="margin-space-event-detail">
            <Calendar aria-hidden="true" />
            <time dateTime={data.startsAt}>
              {new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
                timeZone: data.timeZone!,
              }).format(new Date(data.startsAt))}
            </time>
          </p>
        )}
        {data.location && (
          <p className="margin-space-event-detail">
            <Pin aria-hidden="true" />
            <span>{data.location}</span>
          </p>
        )}
      </div>
      {data.expiresAt && (
        <div className="margin-space-closure">
          <p>
            <strong>
              Access ends{" "}
              <time dateTime={data.expiresAt}>
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: data.timeZone!,
                }).format(new Date(data.expiresAt))}
              </time>
            </strong>{" "}
            — 48 hours after the event ends.
          </p>
          <p>
            This Space disappears from Your Spaces and search. Posts, comments
            and photos become inaccessible here.
          </p>
        </div>
      )}
    </section>
  );
}
