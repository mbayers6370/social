"use client";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/features/feed/schema";
import { Avatar } from "@/features/feed/post-content";
import { ChevronLeft, ChevronRight } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSpaceClient } from "@/features/spaces/client";
import {
  memberJson,
  MemberRequestError,
  requestMember,
} from "@/features/social/member-client";
import type { MemberTopFriends } from "@/features/social/member-contracts";
import { createRequestId } from "@/lib/local-id";
const endpoint = "/api/profiles/me/top-friends";

export function TopFriendsEditor({
  onSaved,
  onCancel,
  onRestoreFocus,
}: {
  onSaved: (selected: Person[]) => void;
  onCancel: () => void;
  onRestoreFocus: () => void;
}) {
  const client = useSpaceClient();
  const [selected, setSelected] = useState<Person[]>([]);
  const [original, setOriginal] = useState<string[] | null>(null);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const attempt = useRef<{ payload: string; requestId: string } | null>(null);
  const initialized = useRef(false);
  const search = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        try {
          const result = await requestMember<MemberTopFriends>(
            client,
            `${endpoint}?q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          setContacts(result.contacts.map((contact) => contact.person));
          setCursor(result.nextCursor);
          if (!initialized.current) {
            initialized.current = true;
            setSelected(result.selected);
            setOriginal(result.selected.map((person) => person.id));
          }
        } catch (error) {
          if (!controller.signal.aborted)
            setError(
              error instanceof Error
                ? error.message
                : "Your friends could not be loaded.",
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 200 : 0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [client, query]);
  const ids = selected.map((person) => person.id);
  const dirty =
    original !== null && JSON.stringify(ids) !== JSON.stringify(original);
  const locked = busy || uncertain;
  function move(index: number, direction: -1 | 1) {
    const next = [...selected];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setSelected(next);
    setAnnouncement(
      `${selected[index].name} moved ${direction === -1 ? "left" : "right"}.`,
    );
  }
  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    const payload = JSON.stringify(ids);
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { payload, requestId: createRequestId() };
    try {
      const result = await requestMember<{ selected: Person[] }>(
        client,
        endpoint,
        memberJson("PUT", {
          friendIds: ids,
          requestId: attempt.current.requestId,
        }),
      );
      if (mounted.current) onSaved(result.selected);
    } catch (error) {
      if (mounted.current) {
        setUncertain(error instanceof MemberRequestError && error.uncertain);
        setError(
          error instanceof Error
            ? error.message
            : "Your Top 4 could not be saved.",
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <DialogContent
      className="margin-top-friends-editor"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        search.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit Top 4</DialogTitle>
        <DialogDescription>
          Choose up to four friends. Changes are saved when you press Save.
        </DialogDescription>
      </DialogHeader>
      <div
        className="margin-top-friends-selection"
        aria-label="Selected friends"
      >
        {selected.length ? (
          selected.map((person, index) => (
            <div key={person.id} className="margin-top-friends-selection-row">
              <Avatar live person={person} />
              <span>{person.name}</span>
              <div className="margin-top-friends-move">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={locked || index === 0}
                  aria-label={`Move ${person.name} left`}
                  onClick={() => move(index, -1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={locked || index === selected.length - 1}
                  aria-label={`Move ${person.name} right`}
                  onClick={() => move(index, 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={locked}
                  aria-label={`Remove ${person.name}`}
                  onClick={() =>
                    setSelected(
                      selected.filter((friend) => friend.id !== person.id),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="margin-field-hint">No friends selected.</p>
        )}
      </div>
      <label htmlFor="top-friends-search">Search your friends</label>
      <Input
        id="top-friends-search"
        ref={search}
        value={query}
        disabled={locked}
        onChange={(event) => {
          setQuery(event.target.value);
          setError("");
        }}
      />
      <div className="margin-top-friends-candidates" aria-busy={loading}>
        {loading ? (
          <p role="status">Loading friends…</p>
        ) : contacts.length ? (
          contacts.map((person) => (
            <div key={person.id} className="margin-top-friends-candidate">
              <Avatar live person={person} />
              <span>{person.name}</span>
              <Button
                variant="outline"
                disabled={
                  locked ||
                  ids.includes(person.id) ||
                  selected.length === 4 ||
                  original === null
                }
                onClick={() => setSelected([...selected, person])}
              >
                {ids.includes(person.id) ? "Selected" : "Add"}
                <span className="sr-only"> {person.name}</span>
              </Button>
            </div>
          ))
        ) : (
          <p className="margin-field-hint">No friends found.</p>
        )}
        {!loading && cursor && (
          <Button
            variant="ghost"
            disabled={locked}
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const result = await requestMember<MemberTopFriends>(
                  client,
                  `${endpoint}?q=${encodeURIComponent(query)}&before=${encodeURIComponent(cursor)}`,
                );
                if (!mounted.current) return;
                setContacts([
                  ...contacts,
                  ...result.contacts.map((contact) => contact.person),
                ]);
                setCursor(result.nextCursor);
              } catch (error) {
                if (mounted.current)
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Your friends could not be loaded.",
                  );
              } finally {
                if (mounted.current) setLoading(false);
              }
            }}
          >
            More friends
          </Button>
        )}
      </div>
      {error && (
        <p role="alert">
          {error}
          {uncertain &&
            " Retry Save to confirm this change, or Cancel and reopen to check."}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p role="status" className="margin-field-hint">
        {dirty ? "Unsaved changes" : "No unsaved changes"}
      </p>
      <footer className="margin-top-friends-actions">
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </footer>
    </DialogContent>
  );
}
