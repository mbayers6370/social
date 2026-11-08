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
import { Avatar } from "@/features/feed/post-content";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SpaceListData } from "./contracts";
import { SpaceForm } from "./space-form";
import { useSpaceClient } from "./client";
import { SpaceInvitationAction } from "./space-invitation-action";
import { preserveTimeZoneMenu } from "./time-zone-picker";
import { EventSearch } from "./event-search";
import { SpaceDates } from "./space-dates";
import { eventSpacesEnabled, spaceIsVisible } from "./availability";

function SpaceCards({
  spaces,
  label,
  archived = false,
}: {
  spaces: SpaceListData["spaces"];
  label: string;
  archived?: boolean;
}) {
  const client = useSpaceClient();
  const Heading = archived ? "h3" : "h2";
  return (
    <ul className="margin-space-directory" aria-label={label}>
      {spaces.map((space) => (
        <li key={space.id}>
          <Link href={client.href(`/app/spaces/${space.id}`)}>
            <div className="margin-space-row-copy">
              <div className="margin-space-card-title">
                <span className="margin-space-row-icon" aria-hidden="true">
                  {space.kind === "EVENT" ? <EventSpace /> : <Spaces />}
                </span>
                <Heading>{space.name}</Heading>
                <SpaceDates space={space} />
              </div>
              {space.location && (
                <p className="margin-space-card-location">{space.location}</p>
              )}
              <span className="margin-space-card-members">
                {space.memberPreview.length > 0 && (
                  <span
                    className="margin-space-member-portraits"
                    role="img"
                    aria-label={`Members: ${space.memberPreview.map((person) => person.name).join(", ")}`}
                  >
                    {space.memberPreview.map((person) => (
                      <Avatar
                        key={person.id}
                        person={person}
                        live={!client.preview}
                      />
                    ))}
                  </span>
                )}
                <span>
                  {space.memberCount}{" "}
                  {space.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
            </div>
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
      <header className="margin-spaces-intro">
        <div className="margin-spaces-heading">
          <SectionTitle as="h1" motif={<SectionMotif icon={Spaces} />}>
            Your spaces
          </SectionTitle>
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
        </div>
        <p className="margin-spaces-description">
          Little places for the people in your life.
        </p>
      </header>
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
      {current.length > 0 ? (
        <SpaceCards spaces={current} label="Your Spaces" />
      ) : (
        <div className="margin-space-empty">
          <Spaces aria-hidden="true" size={32} />
          <h2>A little room for your people.</h2>
          <p>
            Start a Space for a group of friends, or join one when an invitation
            comes your way. There’s no rush.
          </p>
        </div>
      )}
      <p className="margin-space-privacy">
        <Lock aria-hidden="true" size={14} />
        Spaces are invitation-only.
        {eventSpacesEnabled && " Event Spaces are open to Margin members."}
      </p>
      {archived.length > 0 && (
        <section className="margin-spaces-group">
          <h2>Archived</h2>
          <p className="margin-space-meta">
            Spaces you’ve archived, kept read-only.
          </p>
          <SpaceCards spaces={archived} label="Archived Spaces" archived />
        </section>
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
