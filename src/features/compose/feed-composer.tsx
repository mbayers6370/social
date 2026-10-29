"use client";

import { Avatar } from "@/features/feed/post-content";
import { usePreview } from "@/features/local-preview/provider";
import { NewPostButton } from "./new-post-button";

/** Lightweight feed entry; the full composer loads only after activation. */
export function FeedComposer() {
  const { state, bootstrap } = usePreview();
  const profile = state.profiles.find(
    (item) => item.person.id === bootstrap.viewerId,
  )!;

  return (
    <div
      className="margin-feed-composer"
      role="group"
      aria-label="Create a post"
    >
      <Avatar person={profile.person} />
      <NewPostButton variant="prompt" />
      <NewPostButton variant="photo" />
    </div>
  );
}
