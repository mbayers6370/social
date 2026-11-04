"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spaces } from "@/components/margin-icons";
import { PostCard } from "@/features/feed/post-card";
import { PostPhotos } from "@/features/feed/post-photos";
import type { FeedPost, PostMedia } from "@/features/feed/schema";
import { useSpaceClient } from "./client";
import type { SpacePost } from "./contracts";
import { LiveConversation } from "./live-conversation";
import { SpacePostActions } from "./space-post-actions";
import { MemberPostEdit } from "@/features/social/member-post-edit";
import { PostContent } from "@/features/feed/post-content";
import {
  selectConversation,
  type ConversationSelection,
} from "@/features/feed/conversation-selection";
export const spacePostView = (p: SpacePost): FeedPost => {
  const paragraphs = p.body ? p.body.split(/\n\s*\n/) : [];
  let link: FeedPost["link"];
  try {
    const url = new URL(paragraphs.at(-1) ?? "");
    if (url.protocol === "https:" && !url.username && !url.password) {
      link = { url: url.href, title: url.hostname };
      paragraphs.pop();
    }
  } catch {
    /* Ordinary prose is not a link. */
  }
  return {
    id: p.id,
    author: {
      ...p.author,
      initials: p.author.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 3),
      tone: "paper",
    },
    createdAt: p.createdAt,
    expiresAt: p.expiresAt,
    paragraphs,
    ...(link ? { link } : {}),
    likes: 0,
    comments: [],
  };
};
export type ConversationTarget = { postId: string; commentId?: string };
export function SpacePostCard({
  post: p,
  viewerId,
  inFeed = false,
  profileDate = false,
  conversationTarget,
}: {
  post: SpacePost;
  viewerId?: string;
  inFeed?: boolean;
  profileDate?: boolean;
  conversationTarget?: ConversationTarget;
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const [selection, setSelection] = useState<ConversationSelection | null>(
    null,
  );
  const selected = useRef<ConversationSelection | null>(null);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const opened = useCallback(() => setPhase("open"), []);
  const closing = useCallback(() => setPhase("closing"), []);
  const close = useCallback(() => {
    const previous = selected.current;
    selected.current = null;
    setSelection(null);
    // Consume the open request but retain the post anchor/page. A later click
    // on this same notification can then request the conversation again.
    const url = new URL(window.location.href);
    if (
      url.searchParams.get("post") === p.id &&
      url.searchParams.has("comment")
    ) {
      url.searchParams.delete("comment");
      router.replace(`${url.pathname}?${url.searchParams}`, { scroll: false });
    }
    requestAnimationFrame(() => {
      if (previous)
        window.scrollTo({ top: previous.scrollY, behavior: "instant" });
    });
  }, [p.id, router]);
  const forceFlip = profileDate || !inFeed;
  const photos: PostMedia[] = useMemo(
    () =>
      p.photos.map((photo) => ({
        description: photo.description,
        caption: "",
        aspect: photo.width >= photo.height ? "landscape" : "portrait",
        image: {
          src: client.photoSrc(photo.id),
          width: photo.width,
          height: photo.height,
        },
      })),
    [p.photos, client],
  );
  const post = useMemo(
    () => ({
      ...spacePostView(p),
      ...(photos.length ? { media: photos } : {}),
    }),
    [p, photos],
  );
  const openConversation = useCallback(
    (trigger: HTMLElement, commentId?: string) => {
      if (
        selected.current ||
        document.querySelector(".margin-conversation-frame")
      )
        return;
      const next = selectConversation(post, trigger, forceFlip, commentId);
      if (!next) return;
      selected.current = next;
      setPhase("opening");
      setSelection(next);
    },
    [post, forceFlip],
  );
  const handledTarget = useRef<string | null>(null);
  useEffect(() => {
    if (conversationTarget?.postId !== p.id || !conversationTarget.commentId) {
      handledTarget.current = null;
      return;
    }
    const key = `${p.id}:${conversationTarget.commentId ?? ""}`;
    if (handledTarget.current === key) return;
    const frame = requestAnimationFrame(() => {
      const trigger = document
        .getElementById(p.id)
        ?.querySelector<HTMLElement>("[data-conversation-trigger]");
      if (!trigger) return;
      handledTarget.current = key;
      openConversation(trigger, conversationTarget.commentId);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    conversationTarget?.postId,
    conversationTarget?.commentId,
    p.id,
    openConversation,
  ]);
  const source = p.space ? (
    <Link
      className="margin-space-post-source"
      href={client.href(`/app/spaces/${p.space.id}`)}
      aria-label={`Space: ${p.space.name}`}
    >
      <Spaces aria-hidden="true" />
      {p.space.name}
    </Link>
  ) : null;
  return (
    <>
      <div
        className="margin-post-slot"
        data-selected={Boolean(selection)}
        style={
          selection
            ? ({
                "--post-base-height": `${selection.rect.height}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <PostCard
          post={post}
          selected={Boolean(selection)}
          phase={selection ? phase : undefined}
          conversationLayout={forceFlip ? "flip" : "panel"}
          live={!client.preview}
          profileDate={profileDate}
          reportAction={null}
          actions={
            profileDate &&
            !client.preview &&
            viewerId === p.author.id &&
            !p.space?.archived ? (
              <MemberPostEdit post={p} />
            ) : undefined
          }
          source={source}
          menuActions={(controls) => (
            <SpacePostActions
              post={p}
              viewerId={viewerId}
              inFeed={inFeed}
              controls={controls}
            />
          )}
          onOpenConversation={(_, trigger) => {
            openConversation(trigger);
          }}
        >
          {photos.length > 0 && (
            <PostPhotos
              photos={photos}
              postId={p.id}
              authorName={p.author.name}
              privateMedia={!client.preview}
            />
          )}
          {p.body && <PostContent post={spacePostView(p)} />}
        </PostCard>
      </div>
      <LiveConversation
        post={post}
        selection={selection}
        forceFlip={forceFlip}
        profileDate={profileDate}
        source={source}
        onOpened={opened}
        onClosing={closing}
        onClose={close}
      />
    </>
  );
}
