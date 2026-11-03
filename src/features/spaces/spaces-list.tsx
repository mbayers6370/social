"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Spaces,
  Lock,
  Gathering,
  EventSpace,
  Add,
  ChevronRight,
} from "@/components/margin-icons";
import { SectionTitle, SectionMotif } from "@/components/shared/section-motif";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SpaceListData, SpaceSummary } from "./contracts";
import { SpaceForm } from "./space-form";
import { useSpaceClient } from "./client";
import { SpaceInvitationAction } from "./space-invitation-action";
import { preserveTimeZoneMenu } from "./time-zone-picker";
import { spaceKindLabel } from "./lifecycle";
import { EventSearch } from "./event-search";

function SpaceRows({
  spaces,
  label,
}: {
  spaces: SpaceSummary[];
  label: string;
}) {
  const client = useSpaceClient();
  return (
    <ul className="margin-space-directory" aria-label={label}>
      {spaces.map((space) => (
        <li key={space.id}>
          <Link href={client.href(`/app/spaces/${space.id}`)}>
            <span className="margin-space-row-icon" aria-hidden="true">
              {space.kind === "PRIVATE" ? (
                <Spaces />
              ) : space.kind === "GATHERING" ? (
                <Gathering />
              ) : (
                <EventSpace />
              )}
            </span>
            <span className="margin-space-row-copy">
              <strong>{space.name}</strong>
              <span className="margin-space-meta">
                {spaceKindLabel(space.kind)} · {space.memberCount}{" "}
                {space.memberCount === 1 ? "member" : "members"}
              </span>
              {space.startsAt && (
                <time className="margin-space-date" dateTime={space.startsAt}>
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeZone: space.timeZone!,
                  }).format(new Date(space.startsAt))}
                  {space.location ? ` · ${space.location}` : ""}
                </time>
              )}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="margin-space-row-arrow"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SpacesList({ data }: { data: SpaceListData }) {
  const [create, setCreate] = useState(false);
  const client = useSpaceClient();
  const current = data.spaces.filter((space) => !space.archivedAt);
  const archived = data.spaces.filter((space) => space.archivedAt);
  return (
    <section className="margin-spaces-page">
      <header className="margin-spaces-heading">
        <div>
          <SectionTitle as="h1" motif={<SectionMotif icon={Spaces} />}>
            Spaces
          </SectionTitle>
          <p>A place for your people, plans and shared moments.</p>
        </div>
        <Dialog open={create} onOpenChange={setCreate}>
          <DialogTrigger asChild>
            <Button>
              <Add aria-hidden="true" />
              New Space
            </Button>
          </DialogTrigger>
          <DialogContent onEscapeKeyDown={preserveTimeZoneMenu}>
            <DialogTitle>Create a Space</DialogTitle>
            <DialogDescription>
              Private Spaces and Gathering Spaces are invitation-only. Find
              public events in event search below.
            </DialogDescription>
            <SpaceForm
              onSaved={() => setCreate(false)}
              onCancel={() => setCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </header>
      <p className="margin-space-privacy">
        <Lock aria-hidden="true" size={14} />
        Private Spaces and Gathering Spaces are invitation-only. Event Spaces
        are public to Margin members.
      </p>
      <EventSearch />
      {data.invitations.length > 0 && (
        <section
          id="space-invitations"
          className="margin-space-invitations"
          aria-label="Space invitations"
        >
          <h2>Invitations</h2>
          <ul className="margin-space-invitation-list">
            {data.invitations.map((invitation) => (
              <li key={invitation.id}>
                <span className="margin-space-invitation-copy">
                  <strong>{invitation.space.name}</strong>
                  <span className="margin-space-meta">
                    You’ve been invited to join.
                  </span>
                </span>
                <SpaceInvitationAction invitation={invitation} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {current.length > 0 && (
        <section className="margin-spaces-group">
          <h2>Your Spaces</h2>
          <SpaceRows spaces={current} label="Your Spaces" />
        </section>
      )}
      {archived.length > 0 && (
        <section className="margin-spaces-group">
          <h2>Archived</h2>
          <p className="margin-space-meta">
            Past Gathering Spaces, kept read-only.
          </p>
          <SpaceRows spaces={archived} label="Archived Spaces" />
        </section>
      )}
      {!data.spaces.length && (
        <div className="margin-space-empty">
          <Spaces aria-hidden="true" size={32} />
          <h2>A shared place starts here</h2>
          <p>
            You haven’t joined a Space yet. Find an Event Space, create one for
            people you know, or join through an invitation.
          </p>
          <Button variant="outline" onClick={() => setCreate(true)}>
            Create your first Space
          </Button>
        </div>
      )}
      {data.nextCursor && (
        <Link
          className="margin-space-more"
          href={client.href(
            `/app/spaces?before=${encodeURIComponent(data.nextCursor)}`,
          )}
        >
          More Spaces
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
