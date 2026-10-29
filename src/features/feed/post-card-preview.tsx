"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import type { FeedPost } from "./schema";

/** Mounted only by the development-only component workbench. */
export function PostCardPreview({
  post,
  children,
}: {
  post: FeedPost;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="margin-post-card-preview">
      <Button
        variant="outline"
        aria-pressed={loading}
        onClick={() => setLoading((previous) => !previous)}
      >
        {loading ? "Show loaded post" : "Show loading preview"}
      </Button>
      {loading ? (
        <PostCardSkeleton media={Boolean(post.media)} />
      ) : (
        <PostCard post={post}>{children}</PostCard>
      )}
    </div>
  );
}
