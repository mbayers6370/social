"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Spaces,
  Lock,
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
import { SpaceDates } from "./space-dates";
import { eventSpacesEnabled, spaceIsVisible } from "./availability";

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
              {space.kind === "EVENT" ? <EventSpace /> : <Spaces />}
            </span>
            <span className="margin-space-row-copy">
              <strong>{space.name}</strong>
              <span className="margin-space-meta">
                {spaceKindLabel(space.kind)} · {space.memberCount}{" "}
                {space.memberCount === 1 ? "member" : "members"}
              </span>
              <SpaceDates space={space} />
              {space.location && (
                <span className="margin-space-meta">{space.location}</span>
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
  const visible = data.spaces.filter(spaceIsVisible);
  const current = visible.filter((space) => !space.archivedAt);
  const archived = visible.filter((space) => space.archivedAt);
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
              A private place for your people, shared thoughts, and plans.
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
        Spaces are invitation-only.
        {eventSpacesEnabled && " Event Spaces are open to Margin members."}
      </p>
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
            Spaces you’ve archived, kept read-only.
          </p>
          <SpaceRows spaces={archived} label="Archived Spaces" />
        </section>
      )}
      {!visible.length && (
        <div className="margin-space-empty">
          <Spaces aria-hidden="true" size={32} />
          <h2>A shared place starts here</h2>
          <p>
            You haven’t joined a Space yet. Create one for people you know, join
            through an invitation.
            {eventSpacesEnabled && " Or find an Event Space below."}
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
      {eventSpacesEnabled && <EventSearch />}
    </section>
  );
}
