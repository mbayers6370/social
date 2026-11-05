"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Friends, Search } from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/features/feed/post-content";
import { InviteFriends } from "@/features/account/invite-friends";
import { useSpaceClient } from "@/features/spaces/client";
import { MemberFriendActions } from "./member-friend-actions";
import { FriendProfileLink } from "@/features/friends/friend-profile-link";
import { requestMember } from "./member-client";
import type { MemberFriends as FriendsData } from "./member-contracts";

export function MemberFriends({ initial }: { initial: FriendsData }) {
  const client = useSpaceClient();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [section, setSection] = useState<"friends" | "requests">("friends");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<{
    source: FriendsData;
    data: FriendsData;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const data = page?.source === initial ? page.data : initial;
  const requestCount = data.contacts.filter(
    (contact) =>
      contact.relationship === "incoming" ||
      contact.relationship === "outgoing",
  ).length;
  const showSearch = section === "friends" || requestCount > 10;
  const term = showSearch ? query.trim().replace(/^@/, "").toLowerCase() : "";
  const friendCount = data.contacts.filter(
    (contact) => contact.relationship === "friends",
  ).length;
  const groups =
    section === "friends"
      ? [
          {
            title: "Friends",
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
    <LiveAppShell active="profile">
      <section className="margin-friends-page" aria-labelledby="friends-title">
        <header>
          <div className="margin-section-heading">
            <SectionTitle
              as="h1"
              id="friends-title"
              motif={<SectionMotif icon={Friends} />}
              ref={heading}
              tabIndex={-1}
            >
              Friends
            </SectionTitle>
          </div>
          <div className="margin-friends-intro">
            {" "}
            <p>A small circle, chosen together.</p>
            <InviteFriends />
          </div>
        </header>
        <div
          className="margin-friends-switch"
          role="tablist"
          aria-label="Friend lists"
        >
          {(["friends", "requests"] as const).map((value) => (
            <Button
              variant="ghost"
              type="button"
              role="tab"
              id={`${id}-${value}`}
              aria-selected={section === value}
              aria-controls={`${id}-panel`}
              key={value}
              tabIndex={section === value ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "friends"
                      : event.key === "End"
                        ? "requests"
                        : section === "friends"
                          ? "requests"
                          : "friends";
                  setSection(next);
                  requestAnimationFrame(() =>
                    document.getElementById(`${id}-${next}`)?.focus(),
                  );
                }
              }}
              onClick={() => setSection(value)}
            >
              {value === "friends" ? (
                <>
                  Friends ·{" "}
                  <span>
                    {friendCount}
                    {data.nextCursor ? "+" : ""}
                  </span>
                </>
              ) : (
                "Requests"
              )}
            </Button>
          ))}
        </div>
        {showSearch && (
          <div className="margin-friends-search">
            <Label className="sr-only" htmlFor={`${id}-filter`}>
              Search your {section === "friends" ? "friends" : "requests"}
            </Label>
            <Search aria-hidden="true" />
            <Input
              id={`${id}-filter`}
              type="search"
              maxLength={80}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search your ${section === "friends" ? "friends" : "requests"}`}
            />
          </div>
        )}
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${section}`}
        >
          {section === "requests" && requestCount === 0 ? (
            <div className="margin-friends-group">
              <p className="margin-empty-copy">
                {data.nextCursor
                  ? "Load more to check for requests."
                  : "No requests right now."}
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const contacts = data.contacts.filter(
                (contact) =>
                  contact.relationship === group.kind &&
                  (!term ||
                    `${contact.person.name} ${contact.username}`
                      .toLowerCase()
                      .includes(term)),
              );
              return (
                <section
                  className="margin-friends-group"
                  key={group.kind}
                  aria-label={group.title}
                >
                  {section === "requests" && (
                    <header className="margin-section-heading">
                      <h2>{group.title}</h2>
                      {contacts.length > 0 && (
                        <span>
                          {contacts.length}
                          {data.nextCursor ? "+" : ""}
                        </span>
                      )}
                    </header>
                  )}
                  {!contacts.length ? (
                    <p className="margin-empty-copy">
                      {term
                        ? "No matching profiles in this list."
                        : group.empty}
                    </p>
                  ) : (
                    <ul className="margin-friends-list">
                      {contacts.map((contact) => (
                        <li
                          key={contact.person.id}
                          data-friend={
                            contact.relationship === "friends" || undefined
                          }
                        >
                          {contact.relationship === "friends" ? (
                            <FriendProfileLink
                              live
                              person={contact.person}
                              username={contact.username}
                              href={`/app?person=${encodeURIComponent(contact.person.id)}`}
                              friendsSince={contact.friendsSince}
                            />
                          ) : (
                            <>
                              <Link
                                href={`/app?person=${encodeURIComponent(contact.person.id)}`}
                                className="margin-friend-person"
                              >
                                <Avatar live person={contact.person} />
                                <span>
                                  <strong>{contact.person.name}</strong>
                                  <span>@{contact.username}</span>
                                </span>
                              </Link>
                              <MemberFriendActions
                                person={contact.person}
                                relationship={contact.relationship}
                              />
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>
        {data.nextCursor && (
          <Button
            variant="outline"
            disabled={working}
            onClick={async () => {
              setWorking(true);
              setError("");
              try {
                const next = await requestMember<FriendsData>(
                  client,
                  `/api/friends?before=${encodeURIComponent(data.nextCursor!)}`,
                );
                setPage({
                  source: initial,
                  data: {
                    contacts: [...data.contacts, ...next.contacts],
                    nextCursor: next.nextCursor,
                  },
                });
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Couldn’t load more friends.",
                );
              } finally {
                setWorking(false);
              }
            }}
          >
            Load more
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </LiveAppShell>
  );
}
