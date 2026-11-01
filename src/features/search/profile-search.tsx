"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { usePreview } from "@/features/local-preview/provider";
import { searchProfiles } from "@/features/local-preview/model";
import { friendStatus } from "@/features/friends/model";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ProfileSearch() {
  // Keep the SSR trigger inert until its React handler can open the dialog.
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const { state, bootstrap } = usePreview();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = searchProfiles(state.profiles, query);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search profiles"
          title="Search profiles"
          disabled={!hydrated}
        >
          <Search aria-hidden="true" strokeWidth={1.5} />
        </Button>
      </DialogTrigger>
      <DialogContent className="margin-search-dialog">
        <DialogHeader>
          <DialogTitle>Find a Profile</DialogTitle>
          <DialogDescription>
            Look someone up by name or username.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <Label htmlFor="profile-search">Name or username</Label>
          <Input
            id="profile-search"
            type="search"
            autoComplete="off"
            maxLength={80}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or @username"
          />
        </Field>
        <p role="status" className="margin-field-hint">
          {query.trim()
            ? `${results.length} ${results.length === 1 ? "profile" : "profiles"} found`
            : "Search the sample profiles in this local preview."}
        </p>
        <ul className="margin-search-results">
          {results.map((profile) => (
            <li key={profile.person.id}>
              <Link
                href={`/?view=profile&person=${encodeURIComponent(profile.person.id)}`}
                onClick={() => setOpen(false)}
              >
                <Avatar person={profile.person} />
                <span>
                  <strong>{profile.person.name}</strong>
                  <span>@{profile.handle}</span>
                  <span className="margin-search-friend-status">
                    {
                      (
                        {
                          self: "Your profile",
                          friends: "Friends",
                          incoming: "Wants to be friends",
                          outgoing: "Request sent",
                          none: "",
                          blocked: "Requests unavailable",
                        } as const
                      )[
                        friendStatus(
                          bootstrap.viewerId,
                          profile.person.id,
                          state.friendships,
                        )
                      ]
                    }
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {query.trim() && !results.length && (
          <p className="margin-empty-copy">
            No profiles match. Try another name or username.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
