"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { EventSpace } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventSearchPage } from "./contracts";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";

export function EventSearch() {
  const id = useId();
  const client = useSpaceClient();
  const router = useRouter();
  const action = useSpaceAction();
  const pending = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState<EventSearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => pending.current?.abort(), []);
  useLayoutEffect(() => {
    const list = resultsRef.current;
    if (!list) return;
    const rows = [...list.children].slice(0, 4);
    const measure = () => {
      const last = rows.at(-1);
      if (!last) return;
      const height = Math.ceil(
        last.getBoundingClientRect().bottom -
          list.getBoundingClientRect().top +
          list.scrollTop,
      );
      list.style.setProperty("--event-results-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [page?.events]);

  async function search(query: string, before?: string) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    if (!before) setPage(null);
    try {
      const params = new URLSearchParams({ q: query });
      if (before) params.set("before", before);
      const response = await client.request(`/api/spaces/events?${params}`, {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      });
      if (!response.ok)
        throw Error(
          "Event search is temporarily unavailable. Please try again.",
        );
      const result: EventSearchPage = await response.json();
      if (controller.signal.aborted) return;
      setSubmitted(query);
      setPage((current) =>
        before && current
          ? {
              ...result,
              events: [
                ...new Map(
                  [...current.events, ...result.events].map((event) => [
                    event.id,
                    event,
                  ]),
                ).values(),
              ],
            }
          : result,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Event Spaces couldn’t be loaded.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function join(event: EventSearchPage["events"][number]) {
    if (joining) return;
    setJoining(event.id);
    const result = await action.run(
      event.ticketmasterId
        ? `/api/spaces/events/${event.ticketmasterId}/join`
        : `/api/spaces/${event.id}/join`,
      "POST",
      event.ticketmasterId ? {} : undefined,
      false,
      { refresh: false },
    );
    setJoining(null);
    if (result) {
      router.push(client.href(`/app/spaces/${result.id}`));
    }
  }
  return (
    <section className="margin-event-search" aria-labelledby={`${id}-heading`}>
      <div>
        <h2 id={`${id}-heading`}>Find an Event Space</h2>
        <p>
          Meet other members going to the same event. You don’t need to be
          friends.
        </p>
      </div>
      <form
        className="margin-event-search-form"
        role="search"
        aria-label="Event Spaces"
        onSubmit={(event) => {
          event.preventDefault();
          void search(query.trim());
        }}
      >
        <div>
          <Label htmlFor={`${id}-query`}>Artist name</Label>
          <Input
            aria-label="Search Event Spaces"
            id={`${id}-query`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
            maxLength={100}
            placeholder="Search for an artist"
          />
        </div>
        <Button type="submit" disabled={loading}>
          Search events
        </Button>
      </form>
      <p className="margin-field-hint">
        Public events from Ticketmaster. Join a Space to see and share posts,
        comments, and photos. Each Space disappears 48 hours after the event
        ends, and its content becomes inaccessible.
      </p>
      {loading && <p role="status">Searching Event Spaces…</p>}
      {error && <p role="alert">{error}</p>}
      {action.error && <p role="alert">{action.error}</p>}
      {page?.notice && <p role="status">{page.notice}</p>}
      {page && (
        <div aria-live="polite">
          {!page.events.length ? (
            <p>No events found. Try another artist name.</p>
          ) : (
            <ul
              ref={resultsRef}
              className="margin-event-results"
              tabIndex={0}
              aria-label="Event search results"
            >
              {page.events.map((event) => (
                <li key={event.id}>
                  <div className="margin-event-result-media">
                    {event.imageUrl ? (
                      <Image
                        src={event.imageUrl}
                        alt=""
                        width={320}
                        height={200}
                        sizes="(min-width: 640px) 112px, 80px"
                      />
                    ) : (
                      <EventSpace aria-hidden="true" />
                    )}
                  </div>
                  <div className="margin-event-result-copy">
                    <h3>{event.name}</h3>
                    {event.startsAt && (
                      <time dateTime={event.startsAt}>
                        {new Intl.DateTimeFormat("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZoneName: "short",
                          timeZone: event.timeZone!,
                        }).format(new Date(event.startsAt))}
                      </time>
                    )}
                    {event.location && <p>{event.location}</p>}
                    {event.memberCount > 0 && (
                      <p>
                        {event.memberCount}{" "}
                        {event.memberCount === 1 ? "member" : "members"}
                      </p>
                    )}
                    {event.sourceUrl && (
                      <a
                        className="margin-event-source"
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        More info on Ticketmaster
                      </a>
                    )}
                  </div>
                  {event.isMember ? (
                    <Link
                      className="margin-space-more"
                      href={client.href(`/app/spaces/${event.id}`)}
                    >
                      Open Space
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={Boolean(joining)}
                      aria-label={`Join ${event.name}`}
                      onClick={() => join(event)}
                    >
                      {joining === event.id ? "Joining…" : "Join Space"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {page.nextCursor && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => search(submitted, page.nextCursor!)}
            >
              More events
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
