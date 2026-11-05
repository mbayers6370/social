"use client";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { requestMember } from "@/features/social/member-client";
import type { SpaceInvitationCandidates } from "./contracts";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";

export function SpaceInvitation({ spaceId }: { spaceId: string }) {
  const id = useId();
  const client = useSpaceClient();
  const action = useSpaceAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [sent, setSent] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{
    key: string;
    data?: SpaceInvitationCandidates;
    error?: string;
  }>();
  const term = query.trim().replace(/^@/, "");
  const key = `${spaceId}:${term}:${retry}`;
  const eligible = term.length !== 1;
  const current = result?.key === key ? result : undefined;
  const waiting = eligible && !current;
  useEffect(() => {
    if (!open || !eligible) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        try {
          const data = await requestMember<SpaceInvitationCandidates>(
            client,
            `/api/spaces/${spaceId}/invitations${term ? `?q=${encodeURIComponent(term)}` : ""}`,
            { signal: controller.signal },
          );
          if (!controller.signal.aborted) setResult({ key, data });
        } catch (error) {
          if (!controller.signal.aborted)
            setResult({
              key,
              error:
                error instanceof Error
                  ? error.message
                  : "Members could not be loaded. Try again.",
            });
        }
      },
      term ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, eligible, key, term, client, spaceId]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setResult(undefined);
          setMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Invite someone</Button>
      </DialogTrigger>
      <DialogContent className="margin-space-invite-dialog">
        <DialogHeader>
          <DialogTitle>Invite to this Space</DialogTitle>
          <DialogDescription>
            Invite an accepted friend by name or username.
          </DialogDescription>
        </DialogHeader>
        <form
          role="search"
          aria-label="Find a Space invitee"
          autoComplete="off"
          onSubmit={(event) => event.preventDefault()}
        >
          <Label htmlFor={id}>Search friends</Label>
          <Input
            id={id}
            type="search"
            name="space-member-search"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            maxLength={80}
            value={query}
            placeholder="Name or @handle"
            onChange={(event) => {
              setQuery(event.target.value);
              setMessage("");
            }}
          />
        </form>
        <p role="status" className="margin-field-hint">
          {message ||
            (waiting
              ? "Finding members…"
              : !eligible
                ? "Enter at least two characters."
                : current?.data?.members.length
                  ? "Invitations appear in the recipient’s Spaces."
                  : term
                    ? "No matching friends are available to invite."
                    : "Search your accepted friends by name or username.")}
        </p>
        {current?.data && (
          <div
            className="margin-space-invite-results"
            aria-label="Members available to invite"
            tabIndex={0}
          >
            {!!current.data.members.length && (
              <section aria-labelledby={`${id}-friends`}>
                <h3 id={`${id}-friends`}>Your friends</h3>
                <ul>
                  {current.data.members.map(({ person, username }) => (
                    <li key={person.id}>
                      <Avatar person={person} live={!client.preview} small />
                      <span>
                        <strong>{person.name}</strong>
                        <span>@{username}</span>
                      </span>
                      <Button
                        variant="outline"
                        disabled={action.busy || sent.includes(person.id)}
                        aria-label={
                          sent.includes(person.id)
                            ? `${person.name} invited`
                            : `Invite ${person.name}`
                        }
                        onClick={async () => {
                          if (
                            await action.run(
                              `/api/spaces/${spaceId}/invitations`,
                              "POST",
                              { targetId: person.id },
                              false,
                              { refresh: false },
                            )
                          ) {
                            setSent((ids) => [...ids, person.id]);
                            setMessage(`Invitation sent to ${person.name}.`);
                          }
                        }}
                      >
                        {sent.includes(person.id) ? "Invited" : "Invite"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {current.data.hasMore && (
              <p className="margin-field-hint">
                Showing the first 20 matches. Refine your search to find someone
                else.
              </p>
            )}
          </div>
        )}
        {current?.error && (
          <div role="alert">
            <p>{current.error}</p>
            <Button
              variant="outline"
              onClick={() => setRetry((count) => count + 1)}
            >
              Try again
            </Button>
          </div>
        )}
        {action.error && <p role="alert">{action.error}</p>}
      </DialogContent>
    </Dialog>
  );
}
