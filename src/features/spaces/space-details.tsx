"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock, EventSpace } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { SpaceOptions } from "./space-options";
import { Avatar } from "@/features/feed/post-content";
import type { SpaceDetails as Data } from "./contracts";
import { useSpaceClient } from "./client";
import { SpaceOverview } from "./space-overview";
import { SpaceMembers } from "./space-members";
import type { Person } from "@/features/feed/schema";
import { SpaceComposer, type SpaceComposerHandle } from "./space-composer";
import { SpaceRsvp } from "./space-rsvp";

export function SpaceDetails({
  data,
  children,
  hasPosts = true,
  viewer,
}: {
  data: Data;
  children?: ReactNode;
  hasPosts?: boolean;
  viewer?: Person;
}) {
  const client = useSpaceClient();
  const composer = useRef<SpaceComposerHandle>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!data.expiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = Date.parse(data.expiresAt!) - Date.now();
      if (remaining <= 0) setExpired(true);
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    timer = setTimeout(check, 0);
    return () => clearTimeout(timer);
  }, [data.expiresAt]);
  const member = data.members.find((member) => member.userId === data.viewerId);
  const author: Person = viewer ?? {
    id: data.viewerId,
    name: member?.name ?? "You",
    initials: (member?.name ?? "You")
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3),
    tone: "paper",
  };
  const stream = (
    <div key="stream" className="margin-space-stream">
      {!data.archivedAt && (
        <SpaceComposer
          spaceId={data.id}
          spaceName={data.name}
          viewer={author}
          ref={composer}
        />
      )}
      {data.archivedAt && (
        <p className="margin-space-archive-note" role="status">
          {hasPosts
            ? "This Space is archived. You can still read its posts and conversations."
            : "This Space is archived. There are no current posts to read."}
        </p>
      )}
      {!hasPosts && !data.archivedAt && (
        <section
          className="margin-space-welcome"
          aria-label="Start the conversation"
        >
          <h2>Make this Space yours</h2>
          <p>
            Share a plan, ask a question, or add a photo for the people here.
          </p>
          <Button
            onClick={() => {
              composer.current?.open();
            }}
          >
            Write the first post
          </Button>
        </section>
      )}
      {children}
    </div>
  );
  if (expired)
    return (
      <section className="margin-spaces-page">
        <h1>This Event Space has expired</h1>
        <p>
          This Space has disappeared from Your Spaces and search. Posts and
          conversations are no longer accessible, and photos can no longer be
          viewed through this Space.
        </p>
        <Link href={client.href("/app/spaces")}>Back to Spaces</Link>
      </section>
    );
  return (
    <section className="margin-spaces-page">
      <header className="margin-space-identity">
        <Link className="margin-space-back" href={client.href("/app/spaces")}>
          <ArrowLeft aria-hidden="true" />
          All Spaces
        </Link>
        <p className="margin-space-eyebrow">
          {data.kind === "EVENT" ? (
            <EventSpace size={14} aria-hidden="true" />
          ) : (
            <Lock size={14} aria-hidden="true" />
          )}
          {data.kind === "EVENT"
            ? "Event Space · Open to Margin members"
            : "Space · Invitation-only"}
        </p>
        <div className="margin-space-title-row">
          <h1>{data.name}</h1>
          {data.imageUrl && (
            <Image
              className="margin-space-event-image"
              src={data.imageUrl}
              alt=""
              width={192}
              height={128}
              sizes="96px"
            />
          )}
        </div>
        <SpaceOverview data={data} />
        <div className="margin-space-people">
          <div className="margin-space-avatars" aria-hidden="true">
            {data.members.slice(0, 4).map((member) => (
              <Avatar
                key={member.userId}
                small
                person={{
                  id: member.userId,
                  name: member.name,
                  initials: member.name
                    .split(/\s+/)
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 3),
                  tone: "paper",
                }}
              />
            ))}
          </div>
          <p>
            {data.memberCount} {data.memberCount === 1 ? "member" : "members"}
            {data.archivedAt ? " · Archived · Read-only" : ""}
          </p>
        </div>
      </header>
      <div className="margin-space-layout">
        <aside
          key="sidebar"
          className="margin-space-sidebar"
          aria-label="Space information"
        >
          <SpaceMembers data={data} />
          <SpaceRsvp data={data} />
          <SpaceOptions data={data} />
        </aside>
        {stream}
      </div>
    </section>
  );
}
