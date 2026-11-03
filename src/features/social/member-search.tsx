"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Search } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { useSpaceClient } from "@/features/spaces/client";
import { requestMember } from "./member-client";
import type { MemberContact, MemberFriends } from "./member-contracts";

export function MemberSearch() {
  const client = useSpaceClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const term = query.trim().replace(/^@/, "");
  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await requestMember<MemberFriends>(
          client,
          `/api/friends?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setResults(data.contacts);
          setSearched(true);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Search is temporarily unavailable.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, term, client]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search profiles"
          title="Search profiles"
        >
          <Search aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="margin-search-dialog">
        <DialogHeader>
          <DialogTitle>Find a Profile</DialogTitle>
          <DialogDescription>
            Look someone up by name or username.
          </DialogDescription>
        </DialogHeader>
        <form
          role="search"
          aria-label="Find a member"
          autoComplete="off"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field>
            <Label htmlFor={id}>Search members</Label>
            <Input
              id={id}
              type="search"
              name="member-search-query"
              maxLength={80}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              value={query}
              placeholder="Search by name or @handle"
              onChange={(event) => {
                setQuery(event.target.value);
                setResults([]);
                setSearched(false);
                setError("");
                setLoading(
                  event.target.value.trim().replace(/^@/, "").length >= 2,
                );
              }}
            />
          </Field>
        </form>
        <p role="status" className="margin-field-hint">
          {loading
            ? "Finding profiles…"
            : term.length < 2
              ? "Enter at least two characters to find a member."
              : searched
                ? `${results.length} ${results.length === 1 ? "profile" : "profiles"} found`
                : ""}
        </p>
        <ul className="margin-search-results">
          {results.map((contact) => (
            <li key={contact.person.id}>
              <Link
                href={`/app?person=${encodeURIComponent(contact.person.id)}`}
                onClick={() => setOpen(false)}
              >
                <Avatar live person={contact.person} />
                <span>
                  <strong>{contact.person.name}</strong>
                  <span>@{contact.username}</span>
                  <span className="margin-search-friend-status">
                    {
                      {
                        self: "Your profile",
                        friends: "Friends",
                        incoming: "Wants to be friends",
                        outgoing: "Request sent",
                        none: "",
                        blocked: "Requests unavailable",
                      }[contact.relationship]
                    }
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {searched && !loading && !results.length && (
          <p className="margin-empty-copy">
            No profiles match. Try another name or username.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
