"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Users, Search } from "lucide-react";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/features/feed/post-content";
import { ProfileSearch } from "@/features/search/profile-search";
import { usePreview } from "@/features/local-preview/provider";
import { searchProfiles } from "@/features/local-preview/model";
import { FriendActions } from "./friend-actions";
import { useFriendFeedback } from "./use-friend-feedback";
import { friendStatus } from "./model";

export function FriendsPage() {
  const { state, bootstrap } = usePreview();
  const [section, setSection] = useState<"friends" | "requests">("friends");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useFriendFeedback();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!status) return;
    // Wait for the removed row and its modal focus scope to unmount.
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === document.body)
        heading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [status]);
  const people = state.profiles.filter(
    (profile) => profile.person.id !== bootstrap.viewerId,
  );
  const matching = query.trim() ? searchProfiles(people, query) : people;
  const relationship = (id: string) =>
    friendStatus(bootstrap.viewerId, id, state.friendships);
  const friends = people.filter(
    (profile) => relationship(profile.person.id) === "friends",
  );
  const incoming = people.filter(
    (profile) => relationship(profile.person.id) === "incoming",
  );
  const groups =
    section === "friends"
      ? [
          {
            title: "Your Friends",
            kind: "friends",
            empty:
              "No friends here yet. Find a profile to send your first request.",
          },
        ]
      : [
          {
            title: "Received",
            kind: "incoming",
            empty: "No requests waiting for you.",
          },
          { title: "Sent", kind: "outgoing", empty: "No outgoing requests." },
        ];
  return (
    <section className="margin-friends-page" aria-labelledby="friends-title">
      <header>
        <Link className="margin-back-link" href="/?view=profile">
          <ChevronLeft aria-hidden="true" />
          Profile
        </Link>
        <div className="margin-section-heading">
          <SectionTitle
            as="h1"
            id="friends-title"
            motif={<SectionMotif icon={Users} />}
            ref={heading}
            tabIndex={-1}
          >
            Friends
          </SectionTitle>
          <div className="margin-find-friends">
            <span>Find a Profile</span>
            <ProfileSearch />
          </div>
        </div>
        <p className="margin-field-hint">
          Friendship goes both ways. Only accepted friends can see your posts
          and gallery.
        </p>
      </header>
      <div
        className="margin-friends-switch"
        role="group"
        aria-label="Show friendships"
      >
        <Button
          variant="ghost"
          aria-pressed={section === "friends"}
          onClick={() => setSection("friends")}
        >
          Friends <span>{friends.length}</span>
        </Button>
        <Button
          variant="ghost"
          aria-pressed={section === "requests"}
          onClick={() => setSection("requests")}
        >
          Requests {incoming.length > 0 && <span>{incoming.length} new</span>}
        </Button>
      </div>
      <Field>
        <Label htmlFor="friends-search">Filter friends and requests</Label>
        <div className="margin-friends-search">
          <Search aria-hidden="true" strokeWidth={1.5} />
          <Input
            id="friends-search"
            value={query}
            maxLength={80}
            type="search"
            placeholder="Name or @username"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Field>
      <p role="status" className="margin-friend-feedback">
        {status}
      </p>
      {groups.map((group) => {
        const rows = matching
          .filter((profile) => relationship(profile.person.id) === group.kind)
          .sort((a, b) => a.person.name.localeCompare(b.person.name));
        return (
          <section
            className="margin-friends-group"
            key={group.kind}
            aria-label={group.title}
          >
            <h2>{group.title}</h2>
            <ul className="margin-friends-list">
              {rows.map((profile) => (
                <li key={profile.person.id}>
                  <Link
                    className="margin-friend-person"
                    href={`/?view=profile&person=${encodeURIComponent(profile.person.id)}`}
                  >
                    <Avatar person={profile.person} />
                    <span>
                      <strong>{profile.person.name}</strong>
                      <span>@{profile.handle}</span>
                    </span>
                  </Link>
                  <FriendActions
                    person={profile.person}
                    onComplete={(message) => {
                      setStatus(message);
                    }}
                  />
                </li>
              ))}
            </ul>
            {!rows.length && (
              <p className="margin-empty-copy">
                {query.trim()
                  ? "No matches. Try another name or username."
                  : group.empty}
              </p>
            )}
          </section>
        );
      })}
      <p className="margin-preview-note">
        Local preview · Requests aren’t sent. Changes reset on refresh.
      </p>
    </section>
  );
}
