"use client";
import Link from "next/link";
import { useRef } from "react";
import { useFeedReveal } from "@/features/feed/use-feed-reveal";
import { useSpaceClient } from "./client";
import { SpacePostCard, type ConversationTarget } from "./space-post-card";
import type { SpacePostPage } from "./contracts";
export function SpaceTimeline({
  data,
  href,
  viewerId,
  conversationTarget,
}: {
  data: SpacePostPage;
  href: string;
  viewerId?: string;
  conversationTarget?: ConversationTarget;
}) {
  const client = useSpaceClient();
  const feed = useRef<HTMLElement>(null);
  useFeedReveal(feed, data.posts, href === "/app/feed");
  if (!data.posts.length && !data.nextCursor) return null;
  return (
    <section
      ref={feed}
      className="margin-space-timeline"
      aria-label="Posts"
      data-main-feed={href === "/app/feed" || undefined}
    >
      {data.posts.map((post) => (
        <SpacePostCard
          key={post.id}
          post={post}
          viewerId={viewerId}
          inFeed={href === "/app/feed"}
          conversationTarget={conversationTarget}
        />
      ))}
      {data.nextCursor && (
        <Link
          href={client.href(
            `${href}?before=${encodeURIComponent(data.nextCursor)}`,
          )}
        >
          Older posts
        </Link>
      )}
    </section>
  );
}
