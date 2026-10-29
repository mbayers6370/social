"use client";
import { FeedEnd } from "./feed-end";

import { FeedComposer } from "@/features/compose/feed-composer";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { calendarDayLabel, chronologicalPosts, dayKey } from "./format";
import { previewPostState } from "./state";
import type { FeedPost } from "./schema";
import type { ConversationSelection } from "./conversation-dialog";
import { usePreview } from "@/features/local-preview/provider";
import { canReadFriendsPost } from "@/lib/friend-audience";
import { PostCard } from "./post-card";
import { groupCommentThreads } from "./comment-threads";
import { PostManagement } from "@/features/profile/post-management";
import type { FriendPost } from "@/features/local-preview/model";

const ConversationDialog = dynamic(
  () =>
    import("./conversation-dialog").then((module) => module.ConversationDialog),
  { ssr: false },
);

export function FeedExperience({
  posts,
  referenceTime,
  renderedPosts,
  profileId,
}: {
  posts: FeedPost[];
  referenceTime: string;
  renderedPosts: Record<string, ReactNode>;
  profileId?: string;
}) {
  const preview = usePreview();
  const { conversationRequest, finishNotificationRequest } = preview;
  const displayDate = new Date(preview.now).toISOString();
  const today = dayKey(displayDate);
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400_000)
    .toISOString()
    .slice(0, 10);
  const ordered = useMemo(
    () =>
      chronologicalPosts(
        [
          ...new Map(
            [...posts, ...preview.state.posts].map((post) => [post.id, post]),
          ).values(),
        ].filter(
          (post) =>
            (profileId
              ? post.author.id === profileId
              : post.author.id !== preview.bootstrap.viewerId) &&
            Date.parse(post.expiresAt) > preview.now &&
            canReadFriendsPost(
              preview.bootstrap.viewerId,
              post.author.id,
              preview.state.friendships,
            ),
        ),
      ),
    [
      posts,
      preview.state.posts,
      preview.state.friendships,
      preview.bootstrap,
      preview.now,
      profileId,
    ],
  );
  const state = preview.interactions;
  const dispatch = preview.dispatchInteraction;
  const [selection, setSelection] = useState<ConversationSelection | null>(
    null,
  );
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const selectionRef = useRef(selection);
  const openConversation = useCallback(
    (post: FeedPost, trigger: HTMLElement, commentId?: string) => {
      if (selectionRef.current) return;
      const card = document.getElementById(post.id);
      if (!card) return;
      const scrollY = window.scrollY;
      let rect = card.getBoundingClientRect();
      if (window.matchMedia("(min-width: 1024px)").matches) {
        const topInset =
          (document.querySelector(".margin-header")?.getBoundingClientRect()
            .height ?? 0) + 32;
        const availableHeight = Math.min(
          640,
          Math.max(0, window.innerHeight - topInset - 32),
        );
        const pairHeight = profileId
          ? availableHeight
          : Math.max(rect.height, availableHeight);
        if (
          rect.top < topInset ||
          rect.top + Math.min(pairHeight, window.innerHeight - topInset - 32) >
            window.innerHeight - 32
        ) {
          window.scrollBy({ top: rect.top - topInset, behavior: "instant" });
          rect = card.getBoundingClientRect();
        }
      }
      const next = {
        commentId,
        post,
        trigger,
        scrollY,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      };
      selectionRef.current = next;
      setPhase("opening");
      setSelection(next);
    },
    [profileId],
  );
  const completeClose = useCallback(() => {
    const previous = selectionRef.current;
    selectionRef.current = null;
    setSelection(null);
    // Focus and scrolling are restored explicitly; the feed never unmounts or reorders.
    requestAnimationFrame(() => {
      if (!previous) return;
      window.scrollTo({ top: previous.scrollY, behavior: "instant" });
      const target = previous.trigger.isConnected
        ? previous.trigger
        : document.getElementById(
            profileId ? "recent-posts-title" : "feed-title",
          );
      target?.focus({ preventScroll: true });
    });
  }, [profileId]);
  const opened = useCallback(() => setPhase("open"), []);
  const closing = useCallback(() => setPhase("closing"), []);
  const selectedPost =
    selection && ordered.find((post) => post.id === selection.post.id);
  const selectionAvailable = Boolean(selectedPost);
  useEffect(() => {
    if (!selection || selectionAvailable) return;
    const frame = requestAnimationFrame(() => {
      if (
        window.history.state?.marginConversation &&
        window.location.hash === `#conversation-${selection.post.id}`
      )
        window.history.back();
      completeClose();
    });
    return () => cancelAnimationFrame(frame);
  }, [selection, selectionAvailable, completeClose]);
  useEffect(() => {
    const request = conversationRequest;
    if (!request) return;
    const destinationProfile =
      request.target.ownerId === preview.bootstrap.viewerId
        ? preview.bootstrap.viewerId
        : undefined;
    if (profileId !== destinationProfile) return;
    const frame = requestAnimationFrame(() => {
      const post = ordered.find((item) => item.id === request.target.postId);
      if (!post) {
        finishNotificationRequest(request.requestId, true);
        return;
      }
      const trigger = document
        .getElementById(post.id)
        ?.querySelector<HTMLButtonElement>("[data-conversation-trigger]");
      if (!trigger) {
        finishNotificationRequest(request.requestId, true);
        return;
      }
      if (request.target.commentId) {
        const threads = groupCommentThreads([
          ...post.comments,
          ...previewPostState(state, post.id).comments,
        ]);
        const index = threads.findIndex(
          (thread) =>
            thread.comment.id === request.target.commentId ||
            thread.replies.some(
              (reply) => reply.id === request.target.commentId,
            ),
        );
        if (index < 0) {
          finishNotificationRequest(request.requestId, true);
          return;
        }
        dispatch({
          type: "reveal",
          postId: post.id,
          visibleCount: index + 1,
          ...(threads[index].comment.id !== request.target.commentId
            ? { rootId: threads[index].comment.id }
            : {}),
        });
      }
      openConversation(post, trigger, request.target.commentId);
      finishNotificationRequest(request.requestId);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    conversationRequest,
    finishNotificationRequest,
    state,
    ordered,
    openConversation,
    dispatch,
    profileId,
    preview.bootstrap.viewerId,
  ]);

  return (
    <>
      <div className="margin-feed-layout" data-profile={Boolean(profileId)}>
        {!profileId && (
          <section className="margin-feed-intro" aria-labelledby="feed-title">
            <h1 id="feed-title" className="sr-only" tabIndex={-1}>
              Feed
            </h1>
            <p className="margin-date">
              <time dateTime={displayDate}>
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "America/Los_Angeles",
                }).format(new Date(displayDate))}
              </time>
            </p>
            <FeedComposer />
            <p role="status" className="margin-status">
              {preview.notificationNavigationStatus}
            </p>
          </section>
        )}
        {profileId && (
          <p
            role="status"
            className="margin-status margin-feed-notification-status"
          >
            {preview.notificationNavigationStatus}
          </p>
        )}
        <div className="margin-feed-column">
          <div
            aria-label={profileId ? "Profile posts" : "Chronological feed"}
            className="margin-feed-list"
          >
            {ordered.map((post, index) => {
              const currentDay = dayKey(post.createdAt);
              const showDay =
                currentDay !== today &&
                (index === 0 ||
                  currentDay !== dayKey(ordered[index - 1].createdAt));
              const selected = selection?.post.id === post.id;
              return (
                <div
                  key={post.id}
                  data-day-start={showDay}
                  data-conversation-open={selected}
                >
                  {showDay && (
                    <h2 className="margin-day-heading">
                      <time dateTime={currentDay}>
                        {currentDay === yesterday
                          ? "Yesterday"
                          : calendarDayLabel(post.createdAt)}
                      </time>
                    </h2>
                  )}
                  <div
                    className="margin-post-slot"
                    data-selected={selected}
                    style={
                      selected
                        ? ({
                            "--post-base-height": `${selection.rect.height}px`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <PostCard
                      post={post}
                      selected={selected}
                      phase={selected ? phase : undefined}
                      onOpenConversation={openConversation}
                      profileDate={Boolean(profileId)}
                      actions={
                        profileId === preview.bootstrap.viewerId ? (
                          <PostManagement post={post as FriendPost} />
                        ) : undefined
                      }
                    >
                      {renderedPosts[post.id]}
                    </PostCard>
                  </div>
                </div>
              );
            })}
          </div>
          {!profileId && <FeedEnd />}
        </div>
      </div>
      {selection && selectedPost && (
        <ConversationDialog
          forceFlip={Boolean(profileId)}
          selection={{ ...selection, post: selectedPost }}
          state={previewPostState(state, selection.post.id)}
          referenceTime={referenceTime}
          dispatch={dispatch}
          onOpened={opened}
          onClosing={closing}
          onClosed={completeClose}
        />
      )}
    </>
  );
}
