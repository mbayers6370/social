"use client";
import { ChevronDown, Settings } from "@/components/margin-icons";
import type { SpaceDetails } from "./contracts";
import { SpaceSettings } from "./space-settings";
import { useSpaceAction } from "./use-space-action";

export function SpaceOptions({ data }: { data: SpaceDetails }) {
  const action = useSpaceAction();
  return (
    <details className="margin-space-disclosure margin-space-options">
      <summary>
        <Settings aria-hidden="true" />
        <span>Space options</span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="margin-space-panel-content">
        <label className="margin-space-preference">
          <input
            type="checkbox"
            checked={data.includeInFeed}
            disabled={action.busy}
            onChange={(event) =>
              action.run(`/api/spaces/${data.id}/members`, "PATCH", {
                action: "preferences",
                includeInFeed: event.target.checked,
              })
            }
          />
          <span>Include posts from this Space in my Feed</span>
        </label>
        {action.error && <p role="alert">{action.error}</p>}
        {data.sourceUrl && (
          <a
            className="margin-event-source"
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Event information on Ticketmaster
          </a>
        )}
        <SpaceSettings data={data} />
      </div>
    </details>
  );
}
