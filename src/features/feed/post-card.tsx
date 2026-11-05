"use client";

import { memo, useRef, type ReactNode } from "react";
import { Conversation, Flag, Profile } from "@/components/margin-icons";
import { PersonLink } from "@/components/shared/person-link";
import { PostOptionsMenu, type PostMenuControls } from "./post-options-menu";
import { Button } from "@/components/ui/button";
import { PostAuthor, PostContent, PostFooter } from "./post-content";
import type { FeedPost } from "./schema";
import { SafetyReportButton } from "@/features/safety/report-button";

type PostCardProps = {
  post: FeedPost;
  live?: boolean;
  reportAction?: ReactNode;
  menuActions?: (controls: PostMenuControls) => ReactNode;
  source?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  profileDate?: boolean;
  selected?: boolean;
  phase?: "opening" | "open" | "closing";
  conversationLayout?: "flip" | "panel";
  onOpenConversation?: (post: FeedPost, trigger: HTMLElement) => void;
};

/** Owns post identity/actions while accepting a server-rendered post body. */
export const PostCard = memo(function PostCard({
  post,
  live = false,
  reportAction,
  menuActions,
  source,
  children,
  actions,
  profileDate,
  selected = false,
  phase,
  conversationLayout,
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
      <Conversation size={20} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only">Conversation</span>
    </Button>
  );

  return (
    <article
      id={post.id}
      className="margin-post-card margin-feed-post"
      aria-label={profileDate ? post.author.name : undefined}
      aria-labelledby={profileDate ? undefined : `author-${post.id}`}
      data-selected={selected}
      data-phase={phase}
      data-conversation-layout={
        conversationLayout ?? (profileDate ? "flip" : "panel")
      }
      data-profile-post={profileDate || undefined}
      data-space-post={Boolean(source) || undefined}
      onPointerDown={(event) => {
        touch.current =
          onOpenConversation &&
          event.currentTarget.contains(event.target as Node) &&
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
      {!profileDate && (
        <PostAuthor
          post={post}
          source={source}
          live={live}
          actions={
            <PostOptionsMenu name={post.author.name}>
              {(controls) => (
                <>
                  <PersonLink
                    person={post.author}
                    live={live}
                    {...controls.itemProps}
                  >
                    <Profile aria-hidden="true" />
                    View profile
                  </PersonLink>
                  {menuActions ? (
                    menuActions(controls)
                  ) : (
                    <SafetyReportButton
                      target={{
                        kind: "post",
                        id: post.id,
                        personId: post.author.id,
                        label: `Post by ${post.author.name}`,
                      }}
                      onCloseAutoFocus={controls.restoreFocus}
                      trigger={
                        <Button variant="ghost" {...controls.itemProps}>
                          <Flag aria-hidden="true" />
                          Report post
                        </Button>
                      }
                    />
                  )}
                </>
              )}
            </PostOptionsMenu>
          }
        />
      )}
      {children ?? <PostContent post={post} />}
      <PostFooter
        post={post}
        profileDate={profileDate}
        actions={
          <>
            {profileDate && actions}
            {conversation}
            {profileDate &&
              (reportAction !== undefined ? (
                reportAction
              ) : (
                <SafetyReportButton
                  target={{
                    kind: "post",
                    id: post.id,
                    personId: post.author.id,
                    label: `Post by ${post.author.name}`,
                  }}
                />
              ))}
          </>
        }
      />
    </article>
  );
});
