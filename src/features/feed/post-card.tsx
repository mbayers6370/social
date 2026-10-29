"use client";

import { memo, useRef, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostAuthor, PostContent, PostFooter } from "./post-content";
import type { FeedPost } from "./schema";

type PostCardProps = {
  post: FeedPost;
  children?: ReactNode;
  actions?: ReactNode;
  profileDate?: boolean;
  selected?: boolean;
  phase?: "opening" | "open" | "closing";
  onOpenConversation?: (post: FeedPost, trigger: HTMLElement) => void;
};

/** Accepts server-rendered content while keeping gestures local to each post. */
export const PostCard = memo(function PostCard({
  post,
  children,
  actions,
  profileDate,
  selected = false,
  phase,
  onOpenConversation,
}: PostCardProps) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const conversation = onOpenConversation && (
    <Button
      variant="ghost"
      data-conversation-trigger
      aria-label={`Conversation on ${post.author.name}’s post`}
      aria-haspopup="dialog"
      aria-expanded={selected}
      title={selected ? "Conversation opened" : "Open conversation"}
      className="margin-conversation-trigger"
      onClick={(event) => onOpenConversation(post, event.currentTarget)}
    >
      <MessageCircle size={20} aria-hidden="true" strokeWidth={1.5} />
      <span>Conversation</span>
    </Button>
  );

  return (
    <article
      id={post.id}
      className="margin-post-card margin-feed-post"
      aria-labelledby={`author-${post.id}`}
      data-selected={selected}
      data-phase={phase}
      data-conversation-layout={profileDate ? "flip" : "panel"}
      onPointerDown={(event) => {
        touch.current =
          onOpenConversation &&
          event.pointerType === "touch" &&
          !(event.target as Element).closest("a,button,input,textarea")
            ? { x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
      onPointerUp={(event) => {
        const start = touch.current;
        touch.current = null;
        if (
          !start ||
          !onOpenConversation ||
          window.matchMedia("(min-width: 1024px)").matches
        )
          return;
        if (
          start.x - event.clientX >
            Math.max(80, event.currentTarget.clientWidth * 0.4) &&
          Math.abs(start.y - event.clientY) < 50
        ) {
          const trigger = event.currentTarget.querySelector<HTMLButtonElement>(
            "[data-conversation-trigger]",
          );
          if (trigger) onOpenConversation(post, trigger);
        }
      }}
    >
      {children ?? (
        <>
          <PostAuthor post={post} profileDate={profileDate} />
          <PostContent post={post} />
        </>
      )}
      {("audience" in post || actions || profileDate || conversation) && (
        <PostFooter
          post={post}
          profileDate={profileDate}
          actions={
            actions || conversation ? (
              <>
                {actions}
                {conversation}
              </>
            ) : undefined
          }
        />
      )}
    </article>
  );
});
