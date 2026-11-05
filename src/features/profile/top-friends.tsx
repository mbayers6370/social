"use client";
import { useRef, useState } from "react";
import type { Person } from "@/features/feed/schema";
import { Avatar } from "@/features/feed/post-content";
import { PersonLink } from "@/components/shared/person-link";
import { Friends, ChevronRight } from "@/components/margin-icons";
import { SectionTitle, SectionMotif } from "@/components/shared/section-motif";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { memberChanged } from "@/features/social/member-client";
import { ProfileSection } from "./profile-section";
import { TopFriendsEditor } from "./top-friends-editor";

/** Absence means private/disabled. An empty authorized list offers only its owner a prompt. */
export function TopFriends({
  friends,
  own,
  onSaved,
}: {
  friends?: Person[];
  own: boolean;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const headerTrigger = useRef<HTMLButtonElement | null>(null);
  const [optimistic, setOptimistic] = useState<{
    source: Person[] | undefined;
    friends: Person[];
  } | null>(null);
  const saved =
    optimistic && optimistic.source === friends ? optimistic.friends : friends;
  if (!saved || (!own && !saved.length)) return null;
  return (
    <Dialog open={editing} onOpenChange={setEditing}>
      <ProfileSection
        className="margin-top-friends"
        aria-labelledby="top-friends-title"
      >
        <header className="margin-section-heading">
          <SectionTitle
            id="top-friends-title"
            motif={<SectionMotif icon={Friends} />}
          >
            Top 4
          </SectionTitle>
          {own && (
            <DialogTrigger asChild>
              <button
                ref={headerTrigger}
                type="button"
                className="margin-section-link"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                }}
              >
                Edit
                <ChevronRight aria-hidden="true" />
              </button>
            </DialogTrigger>
          )}
        </header>
        {saved.length ? (
          <div className="margin-top-friends-grid">
            {saved.map((person) => (
              <PersonLink live key={person.id} person={person}>
                <Avatar live person={person} sizes="44px" />
                <span>{person.name}</span>
              </PersonLink>
            ))}
          </div>
        ) : (
          <DialogTrigger asChild>
            <button
              type="button"
              className="margin-top-friends-prompt margin-section-link"
              onClick={(event) => {
                opener.current = event.currentTarget;
              }}
            >
              Choose your Top 4
            </button>
          </DialogTrigger>
        )}
      </ProfileSection>
      {own && editing && (
        <TopFriendsEditor
          onSaved={(selected) => {
            setOptimistic({ source: friends, friends: selected });
            setEditing(false);
            memberChanged();
            onSaved?.();
          }}
          onCancel={() => setEditing(false)}
          onRestoreFocus={() => {
            const target = opener.current?.isConnected
              ? opener.current
              : headerTrigger.current;
            target?.focus({ preventScroll: true });
          }}
        />
      )}
    </Dialog>
  );
}
