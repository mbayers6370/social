"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import type { Person } from "@/features/feed/schema";
import { cn } from "@/lib/utils";

export function profileHref(personId: string) {
  // Locally added comments use this alias for the signed-in preview identity.
  if (personId === "local-viewer") return "/?view=profile";
  return `/?view=profile&person=${encodeURIComponent(personId)}`;
}

/** A person's identity always opens that person's profile. */
export function PersonLink({
  person,
  className,
  onNavigate,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  person: Pick<Person, "id">;
}) {
  return (
    <Link
      {...props}
      href={profileHref(person.id)}
      className={cn("margin-person-link", className)}
      onNavigate={(event) => {
        if (onNavigate) return onNavigate(event);
        // A conversation adds a temporary history entry. Leave a clean page
        // behind so Back from a profile doesn't return to an orphaned dialog.
        if (window.history.state?.marginConversation) {
          const state = { ...window.history.state };
          delete state.marginConversation;
          window.history.replaceState(
            state,
            "",
            window.location.pathname + window.location.search,
          );
        }
      }}
    />
  );
}
