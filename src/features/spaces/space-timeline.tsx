"use client";
import Link from "next/link";
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
  if (!data.posts.length && !data.nextCursor) return null;
  return (
    <section className="margin-space-timeline" aria-label="Posts">
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
