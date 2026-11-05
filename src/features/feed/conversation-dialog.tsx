"use client";

import { createLocalId } from "@/lib/local-id";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronDown,
  Heart,
  MoreHorizontal,
  Conversation,
  Close,
} from "@/components/margin-icons";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PersonLink } from "@/components/shared/person-link";
import { PostAuthor, PostContent, PostFooter } from "./post-content";
import { CommentForm } from "./comment-form";
import { ConversationComments } from "./conversation-comments";
import { groupCommentThreads } from "./comment-threads";
import type { Person } from "./schema";
import type { PreviewAction, PreviewPostState } from "./state";
import type { ConversationSelection } from "./conversation-selection";
export type { ConversationSelection } from "./conversation-selection";

/** The transport supplies live discussion controls; geometry and presentation
 * remain identical to the development conversation. */
export type ConversationContent = {
  action: ReactNode;
  discussion: ReactNode;
  composer: (
    desktop: boolean,
    onPosted: (commentId: string) => void,
  ) => ReactNode;
  description: string;
  empty: boolean;
};
const DESKTOP = "(min-width: 1024px)";
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia(DESKTOP);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function ConversationDialog({
  selection,
  viewer,
  state,
  referenceTime,
  dispatch,
  onOpened,
  onClosing,
  onClosed,
  forceFlip = false,
  profileDate = forceFlip,
  live = false,
  content,
  source,
  closeDisabled = false,
}: {
  selection: ConversationSelection;
  viewer: Person;
  state: PreviewPostState;
  referenceTime: string;
  dispatch: Dispatch<PreviewAction>;
  onOpened: () => void;
  onClosing: () => void;
  onClosed: () => void;
  forceFlip?: boolean;
  profileDate?: boolean;
  live?: boolean;
  content?: ConversationContent;
  source?: ReactNode;
  closeDisabled?: boolean;
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
  const [pendingComment, setPendingComment] = useState<string | null>(
    selection.commentId ?? null,
  );
  const scrolledComment = useRef<string | null>(null);
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
    if (!frame || !pendingComment || scrolledComment.current === pendingComment)
      return;
    const scroll = frame.querySelector<HTMLDivElement>(
      ".margin-conversation-scroll",
    );
    const target = document.getElementById(
      `comment-${post.id}-${pendingComment}`,
    );
    // Wait for both the comment and its expanded thread to commit before scrolling.
    if (!scroll || !target || target.closest("[hidden]")) return;
    scroll.scrollTop +=
      target.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      16;
    // Focusing a tall panel's composer can scroll the page past its comments.
    // Reveal the saved comment in the page as well as in the inner scroller.
    if (desktop || inlineFlip) {
      const bounds = target.getBoundingClientRect();
      const top =
        (document.querySelector(".margin-header")?.getBoundingClientRect()
          .bottom ?? 0) + 16;
      const bottom = window.innerHeight - 16;
      if (bounds.top < top)
        window.scrollBy({ top: bounds.top - top, behavior: "instant" });
      else if (bounds.bottom > bottom)
        window.scrollBy({ top: bounds.bottom - bottom, behavior: "instant" });
    }
    scrolledComment.current = pendingComment;
    // Live comments arrive after the dialog's initial autofocus has run.
    // Move focus only while it remains on the dialog's initial Back control.
    if (document.activeElement === closeButton.current) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }, [
    frame,
    pendingComment,
    post.id,
    desktop,
    inlineFlip,
    state.comments.length,
    state.expandedReplies,
    state.visibleCount,
  ]);

  const conversationMeta = (
    <footer className="margin-conversation-footer">
      <span data-like-count>
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
      if (closing.current || closeDisabled) return;
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
    [onClosed, onClosing, closeDisabled],
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
                  top: "var(--margin-viewport-top, 0px)",
                  width: "100vw",
                  height: "var(--margin-viewport-height, 100dvh)",
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

  const conversationPreview = (
    <span className="margin-conversation-trigger">
      <Conversation size={20} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only">Conversation</span>
    </span>
  );

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
          data-feed-dividers={selection.mainFeed || undefined}
          data-profile-flip={profileDate || undefined}
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
              "--post-top": `${wideScreen ? selection.documentTop : rect.top}px`,
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
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Let Radix release its scope and React reveal the original post.
            // Check connectivity in that frame: the trigger may unmount meanwhile.
            requestAnimationFrame(() => {
              const target = selection.trigger.isConnected
                ? selection.trigger
                : (document.getElementById(
                    profileDate ? "recent-posts-title" : "feed-title",
                  ) ?? document.getElementById("main-content"));
              target?.focus({ preventScroll: true });
            });
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onFocusOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
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
            data-profile-snapshot={profileDate || undefined}
            aria-hidden="true"
            inert
          >
            {!profileDate && (
              <PostAuthor
                live={live}
                source={source}
                post={{ ...post, id: `snapshot-${post.id}` }}
                actions={
                  <span className="margin-post-menu-preview">
                    <MoreHorizontal aria-hidden="true" />
                  </span>
                }
              />
            )}
            <PostContent post={post} privateMedia={live} />
            <PostFooter
              post={post}
              profileDate={profileDate}
              actions={conversationPreview}
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
                disabled={closeDisabled}
              >
                <ChevronLeft aria-hidden="true" />
                <span>Post</span>
              </Button>
              <Dialog.Title className="margin-conversation-title lg:sr-only">
                Conversation
                <span className="sr-only"> on {post.author.name}’s post</span>
              </Dialog.Title>
              {content ? (
                content.action
              ) : (
                <Button
                  variant="ghost"
                  className="margin-like"
                  aria-pressed={state.liked}
                  onClick={() => dispatch({ type: "like", postId: post.id })}
                >
                  <Heart
                    aria-hidden="true"
                    fill={state.liked ? "currentColor" : "none"}
                  />
                  <span>{state.liked ? "Liked" : "Like"}</span>
                </Button>
              )}
              <div className="margin-conversation-close-slot">
                <Button
                  ref={desktop ? closeButton : undefined}
                  variant="ghost"
                  size="icon"
                  className="margin-conversation-close"
                  onClick={() => requestClose()}
                  aria-label="Close conversation"
                  disabled={closeDisabled}
                >
                  <Close aria-hidden="true" />
                </Button>
              </div>
            </header>
            <Dialog.Description
              id={`conversation-description-${post.id}`}
              className="sr-only"
            >
              {content?.description ?? (
                <>
                  Parent comments in chronological order, with expandable
                  replies grouped beneath them. Likes and comments in this local
                  preview are not saved. Escape or Back to post returns to your
                  place in the feed.
                </>
              )}
            </Dialog.Description>
            <div
              className="margin-conversation-scroll"
              data-empty={
                (content ? content.empty : !comments.length) || undefined
              }
              tabIndex={0}
              role="region"
              aria-label="Conversation content"
            >
              <div className="margin-post-summary">
                <div className="margin-summary-thumbnail" aria-hidden="true">
                  {post.media ? (
                    <Image
                      {...post.media[0].image}
                      unoptimized={live}
                      alt=""
                      sizes="56px"
                      loading="eager"
                    />
                  ) : (
                    <span>Aa</span>
                  )}
                </div>
                <div>
                  <strong>
                    <PersonLink person={post.author} live={live}>
                      {post.author.name}
                    </PersonLink>
                  </strong>
                  <p>{post.paragraphs[0]}</p>
                </div>
              </div>
              {content ? (
                content.discussion
              ) : (
                <>
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
                      onClick={() =>
                        dispatch({ type: "more", postId: post.id })
                      }
                    >
                      Load more comments
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="margin-conversation-composer">
              {content ? (
                content.composer(desktop, setPendingComment)
              ) : (
                <>
                  <CommentForm
                    viewer={viewer}
                    post={post}
                    state={state}
                    dispatch={dispatch}
                    textareaRef={textarea}
                    compact={desktop}
                    onPosted={(commentId) => {
                      setPendingComment(commentId);
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
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
