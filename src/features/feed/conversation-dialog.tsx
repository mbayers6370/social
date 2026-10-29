"use client";

import { createLocalId } from "@/lib/local-id";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronDown,
  Heart,
  MessageCircle,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PostAuthor, PostContent, PostFooter } from "./post-content";
import { CommentForm } from "./comment-form";
import { ConversationComments } from "./conversation-comments";
import { groupCommentThreads } from "./comment-threads";
import type { FeedPost } from "./schema";
import type { PreviewAction, PreviewPostState } from "./state";

export type ConversationSelection = {
  commentId?: string;
  post: FeedPost;
  trigger: HTMLElement;
  scrollY: number;
  rect: { left: number; top: number; width: number; height: number };
};
const DESKTOP = "(min-width: 1024px)";
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia(DESKTOP);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function ConversationDialog({
  selection,
  state,
  referenceTime,
  dispatch,
  onOpened,
  onClosing,
  onClosed,
  forceFlip = false,
}: {
  selection: ConversationSelection;
  state: PreviewPostState;
  referenceTime: string;
  dispatch: Dispatch<PreviewAction>;
  onOpened: () => void;
  onClosing: () => void;
  onClosed: () => void;
  forceFlip?: boolean;
}) {
  const wideScreen = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  const desktop = wideScreen && !forceFlip;
  const inlineFlip = wideScreen && forceFlip;
  const layout = inlineFlip ? "inline-flip" : desktop ? "panel" : "flip";
  // Radix mounts its portal after the parent effect. Animate when the actual
  // content node mounts rather than assuming it exists on the first effect.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingComment = useRef<string | null>(selection.commentId ?? null);
  const animation = useRef<Animation | null>(null);
  const slotAnimation = useRef<Animation | null>(null);
  const closing = useRef(false);
  const previousMode = useRef<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const historyId = useRef<string | null>(null);
  const { post, rect } = selection;
  const comments = [...post.comments, ...state.comments];
  const threads = groupCommentThreads(comments);

  useLayoutEffect(() => {
    if (!frame || !pendingComment.current) return;
    const scroll = frame.querySelector<HTMLDivElement>(
      ".margin-conversation-scroll",
    );
    const target = document.getElementById(
      `comment-${post.id}-${pendingComment.current}`,
    );
    // Wait for both the comment and its expanded thread to commit before scrolling.
    if (!scroll || !target || target.closest("[hidden]")) return;
    scroll.scrollTop +=
      target.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      16;
    pendingComment.current = null;
  }, [
    frame,
    post.id,
    state.comments.length,
    state.expandedReplies,
    state.visibleCount,
  ]);

  const conversationMeta = (
    <footer className="margin-conversation-footer">
      <span data-like-count>
        <Heart aria-hidden="true" fill="currentColor" strokeWidth={1.5} />
        {post.likes + Number(state.liked)}{" "}
        {post.likes + Number(state.liked) === 1 ? "like" : "likes"}
      </span>
      <span>
        Disappears{" "}
        {new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "America/Los_Angeles",
        }).format(new Date(post.expiresAt))}
        <span className="sr-only">
          {" "}
          (sample expiry; expiration is not active)
        </span>
      </span>
    </footer>
  );

  const requestClose = useCallback(
    (fromHistory = false) => {
      if (closing.current) return;
      closing.current = true;
      onClosing();
      if (
        !fromHistory &&
        window.history.state?.marginConversation === historyId.current
      )
        window.history.back();
      if (
        animation.current &&
        animation.current.currentTime !== null &&
        Number(animation.current.currentTime) > 0
      ) {
        slotAnimation.current?.reverse();
        animation.current.reverse();
      } else onClosed();
    },
    [onClosed, onClosing],
  );

  useEffect(() => {
    const id = historyId.current ?? createLocalId();
    historyId.current = id;
    if (window.history.state?.marginConversation !== id)
      window.history.pushState(
        { ...window.history.state, marginConversation: id },
        "",
        `#conversation-${post.id}`,
      );
    const onPop = () => {
      if (window.history.state?.marginConversation !== id) requestClose(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [post.id, requestClose]);

  useLayoutEffect(() => {
    if (!frame || (!desktop && !inlineFlip)) return;
    const card = document.getElementById(post.id);
    if (!card) return;
    const slot = card.closest<HTMLElement>(".margin-post-slot");
    if (inlineFlip && slot)
      slot.style.height = "var(--margin-conversation-height)";
    const syncGeometry = () => {
      const bounds = card.getBoundingClientRect();
      // The slot stays on the reading grid while only its post translates left.
      const reading = slot?.getBoundingClientRect() ?? bounds;
      frame.style.setProperty("--post-height", `${bounds.height}px`);
      frame.style.setProperty(
        "--post-top",
        `${(inlineFlip ? reading.top : bounds.top) + window.scrollY}px`,
      );
      frame.style.setProperty("--reading-left", `${reading.left}px`);
      frame.style.setProperty("--reading-width", `${reading.width}px`);
    };
    const resize = () => {
      const bounds = card.getBoundingClientRect();
      const topInset =
        (document.querySelector(".margin-header")?.getBoundingClientRect()
          .height ?? 0) + 32;
      const pairHeight = inlineFlip
        ? frame.getBoundingClientRect().height
        : Math.max(bounds.height, frame.getBoundingClientRect().height);
      if (
        !closing.current &&
        (bounds.top < topInset ||
          bounds.top +
            Math.min(pairHeight, window.innerHeight - topInset - 32) >
            window.innerHeight - 32)
      )
        window.scrollBy({ top: bounds.top - topInset, behavior: "instant" });
      syncGeometry();
    };
    resize();
    const observer = new ResizeObserver(syncGeometry);
    observer.observe(inlineFlip && slot ? slot : card);
    window.addEventListener("resize", resize);
    // Document coordinates keep the pair aligned while the page scrolls.
    window.addEventListener("scroll", syncGeometry, { passive: true });
    return () => {
      observer.disconnect();
      if (inlineFlip) slot?.style.removeProperty("height");
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", syncGeometry);
    };
  }, [frame, desktop, inlineFlip, post.id]);

  useEffect(() => {
    if (!frame) return;
    const scroll = frame.querySelector<HTMLDivElement>(
      ".margin-conversation-scroll",
    );
    if (!desktop || !scroll) {
      frame.removeAttribute("data-more-below");
      return;
    }
    // This is a decorative scroll cue; no React re-render is needed on scroll.
    const syncOverflow = () => {
      frame.setAttribute(
        "data-more-below",
        String(
          scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 2,
        ),
      );
    };
    syncOverflow();
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(scroll);
    for (const child of scroll.children) observer.observe(child);
    scroll.addEventListener("scroll", syncOverflow, { passive: true });
    return () => {
      observer.disconnect();
      scroll.removeEventListener("scroll", syncOverflow);
    };
  }, [frame, desktop, comments.length, state.visibleCount]);

  useLayoutEffect(() => {
    const node = frame;
    if (!node) return;
    if (closing.current) {
      onClosed();
      return;
    }
    const reduced =
      document.documentElement.dataset.motion === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resized =
      previousMode.current !== null && previousMode.current !== layout;
    previousMode.current = layout;
    if (resized) closeButton.current?.focus({ preventScroll: true });
    if (!node.animate) {
      onOpened();
      return;
    }
    const keyframes: Keyframe[] = resized
      ? []
      : reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : desktop
          ? [
              {
                opacity: 0,
                clipPath: "inset(0 100% 0 0)",
                transform: "translateX(-16px)",
              },
              {
                opacity: 1,
                clipPath: "inset(0 0% 0 0)",
                transform: "translateX(0)",
              },
            ]
          : inlineFlip
            ? [
                {
                  offset: 0,
                  left: "var(--reading-left)",
                  top: "var(--post-top)",
                  width: "var(--reading-width)",
                  height: `${rect.height}px`,
                  transform: "perspective(1200px) rotateY(0deg)",
                },
                {
                  offset: 0.5,
                  left: "var(--reading-left)",
                  top: "var(--post-top)",
                  width: "var(--reading-width)",
                  height: "var(--margin-conversation-height)",
                  transform: "perspective(1200px) rotateY(-90deg)",
                },
                {
                  offset: 1,
                  left: "var(--reading-left)",
                  top: "var(--post-top)",
                  width: "var(--reading-width)",
                  height: "var(--margin-conversation-height)",
                  transform: "perspective(1200px) rotateY(-180deg)",
                },
              ]
            : [
                {
                  offset: 0,
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  transform: "perspective(1200px) rotateY(0deg) translateY(0)",
                  borderRadius: "4px",
                },
                {
                  offset: 0.29,
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  transform:
                    "perspective(1200px) rotateY(-90deg) translateY(-4px)",
                  borderRadius: "4px",
                },
                {
                  offset: 0.62,
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  transform: "perspective(1200px) rotateY(-180deg)",
                  borderRadius: "4px",
                },
                {
                  offset: 1,
                  left: "0px",
                  top: "0px",
                  width: "100%",
                  height: "100dvh",
                  transform: "perspective(1200px) rotateY(-180deg)",
                  borderRadius: "0px",
                },
              ];
    const motion = node.animate(keyframes, {
      duration: resized ? 1 : reduced ? 120 : desktop ? 320 : 520,
      easing: "cubic-bezier(.22,.68,.18,1)",
      fill: "both",
    });
    const slot = inlineFlip
      ? document
          .getElementById(post.id)
          ?.closest<HTMLElement>(".margin-post-slot")
      : null;
    const resizing =
      slot?.animate && !reduced && !resized
        ? slot.animate(
            [
              { offset: 0, height: `${rect.height}px` },
              { offset: 0.5, height: "var(--margin-conversation-height)" },
              { offset: 1, height: "var(--margin-conversation-height)" },
            ],
            {
              duration: 520,
              easing: "cubic-bezier(.22,.68,.18,1)",
              fill: "both",
            },
          )
        : null;
    slotAnimation.current = resizing;
    animation.current = motion;
    motion.onfinish = () => {
      if (motion.playbackRate < 0) onClosed();
      else onOpened();
    };
    return () => {
      motion.onfinish = null;
      motion.cancel();
      resizing?.cancel();
      slotAnimation.current = null;
    };
  }, [frame, desktop, inlineFlip, layout, post.id, onOpened, onClosed, rect]);

  return (
    <Dialog.Root
      open
      modal={!wideScreen}
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="margin-conversation-overlay" />
        <Dialog.Content
          ref={setFrame}
          data-layout={layout}
          data-profile-flip={forceFlip || undefined}
          aria-modal={!wideScreen || undefined}
          className={cn(
            "margin-conversation-frame",
            (document.documentElement.dataset.motion === "reduced" ||
              window.matchMedia("(prefers-reduced-motion: reduce)").matches) &&
              "margin-conversation-reduced",
          )}
          aria-describedby={`conversation-description-${post.id}`}
          style={
            {
              "--post-top": `${wideScreen ? rect.top + window.scrollY : rect.top}px`,
              "--post-height": `${rect.height}px`,
              "--reading-left": `${rect.left}px`,
              "--reading-width": `${rect.width}px`,
            } as React.CSSProperties
          }
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (selection.commentId) {
              const target = document.getElementById(
                `comment-${post.id}-${selection.commentId}`,
              );
              if (target && !target.closest("[hidden]")) {
                target.tabIndex = -1;
                target.focus({ preventScroll: true });
                return;
              }
            }
            closeButton.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            const photo = (event.target as Element).closest?.(
              "[data-post-photo-trigger], [data-post-photo-viewer]",
            );
            if (photo?.getAttribute("data-post-id") === post.id) return;
            requestClose();
          }}
          onPointerDown={(event) => {
            touch.current =
              event.pointerType === "touch" &&
              !(event.target as Element).closest("button,input,textarea,a")
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
              start &&
              !desktop &&
              event.clientX - start.x > Math.max(80, rect.width * 0.4) &&
              Math.abs(event.clientY - start.y) < 50
            )
              requestClose();
          }}
        >
          <div
            className="margin-conversation-front margin-post-card"
            data-profile-snapshot={forceFlip || undefined}
            aria-hidden="true"
            inert
          >
            <PostAuthor
              post={{ ...post, id: `snapshot-${post.id}` }}
              profileDate={forceFlip}
            />
            <PostContent post={post} />
            <PostFooter
              post={post}
              profileDate={forceFlip}
              actions={
                <span className="margin-conversation-trigger">
                  <MessageCircle
                    size={20}
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                  <span>Conversation</span>
                </span>
              }
            />
          </div>
          <div className="margin-conversation-back">
            <header className="margin-conversation-header">
              <Button
                ref={desktop ? undefined : closeButton}
                variant="ghost"
                className="margin-conversation-trigger margin-conversation-back-button"
                onClick={() => requestClose()}
                aria-label="Back to post"
              >
                <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
                <span>Post</span>
              </Button>
              <Dialog.Title className="margin-conversation-title">
                Conversation
                <span className="sr-only"> on {post.author.name}’s post</span>
              </Dialog.Title>
              <Button
                variant="ghost"
                className="margin-like"
                aria-pressed={state.liked}
                onClick={() => dispatch({ type: "like", postId: post.id })}
              >
                <Heart
                  aria-hidden="true"
                  fill={state.liked ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
                <span>{state.liked ? "Liked" : "Like"}</span>
              </Button>
              <div className="margin-conversation-close-slot">
                <Button
                  ref={desktop ? closeButton : undefined}
                  variant="ghost"
                  size="icon"
                  className="margin-conversation-close"
                  onClick={() => requestClose()}
                  aria-label="Close conversation"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </header>
            <Dialog.Description
              id={`conversation-description-${post.id}`}
              className="sr-only"
            >
              Parent comments in chronological order, with expandable replies
              grouped beneath them. Likes and comments in this local preview are
              not saved. Escape or Back to post returns to your place in the
              feed.
            </Dialog.Description>
            <div
              className="margin-conversation-scroll"
              tabIndex={0}
              role="region"
              aria-label="Conversation content"
            >
              <div className="margin-post-summary">
                <div className="margin-summary-thumbnail" aria-hidden="true">
                  {post.media ? (
                    <Image
                      {...post.media[0].image}
                      alt=""
                      sizes="56px"
                      loading="eager"
                    />
                  ) : (
                    <span>Aa</span>
                  )}
                </div>
                <div>
                  <strong>{post.author.name}</strong>
                  <p>{post.paragraphs[0]}</p>
                </div>
              </div>
              {!comments.length && (
                <p className="margin-no-comments">
                  No comments yet. Be the first to leave a thought.
                </p>
              )}
              <ConversationComments
                threads={threads}
                visibleCount={state.visibleCount}
                expandedReplies={state.expandedReplies ?? []}
                postId={post.id}
                postAuthorId={post.author.id}
                referenceTime={referenceTime}
                onReply={(comment) => {
                  dispatch({
                    type: "reply",
                    postId: post.id,
                    replyTo: { id: comment.id, name: comment.author.name },
                  });
                  textarea.current?.focus({ preventScroll: !desktop });
                }}
                onExpandedChange={(commentId, expanded) =>
                  dispatch({
                    type: "replies",
                    postId: post.id,
                    commentId,
                    expanded,
                  })
                }
              />
              {threads.length > state.visibleCount && (
                <Button
                  variant="ghost"
                  className="margin-load-more"
                  onClick={() => dispatch({ type: "more", postId: post.id })}
                >
                  Load more comments
                  <ChevronDown aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="margin-conversation-composer">
              <CommentForm
                post={post}
                state={state}
                dispatch={dispatch}
                textareaRef={textarea}
                compact={desktop}
                onPosted={(commentId) => {
                  pendingComment.current = commentId;
                  const replyTo = state.replyTo;
                  if (replyTo) {
                    const thread = threads.find(
                      ({ comment, replies }) =>
                        comment.id === replyTo.id ||
                        replies.some((reply) => reply.id === replyTo.id),
                    );
                    if (thread)
                      dispatch({
                        type: "replies",
                        postId: post.id,
                        commentId: thread.comment.id,
                        expanded: true,
                      });
                  }
                }}
              />
              {conversationMeta}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
