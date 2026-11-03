"use client";
import { useSpaceClient } from "./client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationDialog } from "@/features/feed/conversation-dialog";
import type { ConversationSelection } from "@/features/feed/conversation-selection";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "@/components/margin-icons";
import { requestMember } from "@/features/social/member-client";
import { CommentForm } from "@/features/feed/comment-form";
import { ConversationComments } from "@/features/feed/conversation-comments";
import { groupCommentThreads } from "@/features/feed/comment-threads";
import type { FeedPost, FeedComment, Person } from "@/features/feed/schema";
import type { PreviewAction } from "@/features/feed/state";
import type { SpaceComments } from "./contracts";
const person = (p: { id: string; name: string }): Person => ({
  ...p,
  initials: p.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3),
  tone: "paper",
});
function mergeComments(
  existing: SpaceComments["comments"],
  incoming: SpaceComments["comments"],
) {
  return [
    ...new Map([...existing, ...incoming].map((c) => [c.id, c])).values(),
  ].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
export function LiveConversation({
  post,
  selection,
  forceFlip = false,
  profileDate = false,
  source,
  onOpened,
  onClosing,
  onClose,
}: {
  post: FeedPost;
  selection: ConversationSelection | null;
  forceFlip?: boolean;
  profileDate?: boolean;
  source?: ReactNode;
  onOpened: () => void;
  onClosing: () => void;
  onClose: () => void;
}) {
  const open = Boolean(selection);
  const targetCommentId = selection?.commentId;
  const client = useSpaceClient();
  const [data, setData] = useState<SpaceComments | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [liking, setLiking] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const generation = useRef(0);
  const olderRequest = useRef<AbortController | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const read = useCallback(
    async function read(before?: string, signal?: AbortSignal) {
      const query = new URLSearchParams();
      if (before) query.set("before", before);
      if (targetCommentId) query.set("comment", targetCommentId);
      const response = await client.request(
        `/api/posts/${post.id}/comments${query.size ? `?${query}` : ""}`,
        {
          cache: "no-store",
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
            : AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok)
        throw Error(
          "This conversation is unavailable. Your access may have changed.",
        );
      return (await response.json()) as SpaceComments;
    },
    [post.id, client, targetCommentId],
  );
  const cancelOlderRead = useCallback(() => {
    ++generation.current;
    olderRequest.current?.abort();
    olderRequest.current = null;
    setLoadingOlder(false);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const version = ++generation.current;
    read(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted && generation.current === version) {
          setData(result);
          const threads = groupCommentThreads(
            result.comments.map((c) => ({ ...c, author: person(c.author) })),
          );
          const target = threads.find((thread) =>
            thread.replies.some((reply) => reply.id === targetCommentId),
          );
          setExpanded(target ? [target.comment.id] : []);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted && generation.current === version)
          setError(e.message);
      });
    return () => {
      controller.abort();
      cancelOlderRead();
    };
  }, [open, read, cancelOlderRead, targetCommentId]);
  const comments: FeedComment[] =
    data?.comments.map((c) => ({ ...c, author: person(c.author) })) ?? [];
  const dispatch = (action: PreviewAction) => {
    if (action.type === "draft") setDraft(action.body);
    else if (action.type === "reply") setReply(action.replyTo);
  };
  const close = useCallback(() => {
    cancelOlderRead();
    setData(null);
    setError("");
    onClose();
  }, [cancelOlderRead, onClose]);
  if (!selection) return null;
  return (
    <ConversationDialog
      selection={selection}
      forceFlip={forceFlip}
      profileDate={profileDate}
      live={!client.preview}
      source={source}
      viewer={person(data?.viewer ?? post.author)}
      state={{
        liked: data?.liked ?? false,
        comments: [],
        draft,
        replyTo: reply,
        expandedReplies: expanded,
        visibleCount: comments.length,
      }}
      dispatch={dispatch}
      referenceTime={new Date().toISOString()}
      onOpened={onOpened}
      onClosing={onClosing}
      onClosed={close}
      closeDisabled={saving}
      content={{
        action: (
          <>
            {data && !data.readOnly && data.liked !== undefined && (
              <Button
                variant="ghost"
                className="margin-like"
                aria-pressed={data.liked}
                disabled={liking}
                onClick={async () => {
                  setLiking(true);
                  setError("");
                  try {
                    const saved = await requestMember<{
                      liked: boolean;
                      count: number;
                    }>(client, `/api/posts/${post.id}/like`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ liked: !data.liked }),
                    });
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            liked: saved.liked,
                            likeCount: saved.count,
                          }
                        : current,
                    );
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Couldn’t save your like.",
                    );
                  } finally {
                    setLiking(false);
                  }
                }}
              >
                <Heart
                  aria-hidden="true"
                  fill={data.liked ? "currentColor" : "none"}
                />
                <span>{data.liked ? "Liked" : "Like"}</span>
              </Button>
            )}
          </>
        ),
        description:
          "Visible only to the post’s current audience. Comments expire with the post. Escape or Back to post returns to your place.",
        empty: comments.length === 0,
        discussion: (
          <>
            {saving && <p role="status">Saving comment…</p>}
            {error && <p role="alert">{error}</p>}
            {data ? (
              <>
                {data.nextCursor && (
                  <Button
                    variant="outline"
                    disabled={loadingOlder || saving}
                    onClick={async () => {
                      if (olderRequest.current) return;
                      const controller = new AbortController();
                      olderRequest.current = controller;
                      const version = generation.current;
                      setLoadingOlder(true);
                      try {
                        const older = await read(
                          data.nextCursor!,
                          controller.signal,
                        );
                        if (
                          controller.signal.aborted ||
                          generation.current !== version
                        )
                          return;
                        setData(
                          (current) =>
                            current && {
                              ...current,
                              nextCursor: older.nextCursor,
                              readOnly: current.readOnly || older.readOnly,
                              comments: mergeComments(
                                older.comments,
                                current.comments,
                              ),
                            },
                        );
                      } catch (e) {
                        if (
                          !controller.signal.aborted &&
                          generation.current === version
                        )
                          setError((e as Error).message);
                      } finally {
                        if (olderRequest.current === controller) {
                          olderRequest.current = null;
                          setLoadingOlder(false);
                        }
                      }
                    }}
                  >
                    {loadingOlder
                      ? "Loading older comments…"
                      : "Older comments"}
                  </Button>
                )}
                <ConversationComments
                  live
                  profileLive={!client.preview}
                  readOnly={data.readOnly}
                  threads={groupCommentThreads(comments)}
                  visibleCount={comments.length}
                  expandedReplies={expanded}
                  onExpandedChange={(id, open) =>
                    setExpanded((v) =>
                      open ? [...v, id] : v.filter((x) => x !== id),
                    )
                  }
                  postId={post.id}
                  postAuthorId={post.author.id}
                  referenceTime={new Date().toISOString()}
                  onReply={(c) => {
                    setReply({ id: c.id, name: c.author.name });
                    setExpanded((v) => [...v, c.replyTo ?? c.id]);
                    text.current?.focus();
                  }}
                />
                {!comments.length && (
                  <p className="margin-no-comments">
                    No comments yet. Be the first to leave a thought.
                  </p>
                )}
                {uncertain && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      cancelOlderRead();
                      const version = generation.current;
                      try {
                        const latest = await read();
                        if (generation.current !== version) return;
                        setData(latest);
                        setUncertain(false);
                        setError("");
                      } catch {
                        if (generation.current === version)
                          setError("The conversation is still unavailable.");
                      }
                    }}
                  >
                    Reload conversation to check saved comments
                  </Button>
                )}
              </>
            ) : (
              !error && <p role="status">Loading conversation…</p>
            )}
          </>
        ),
        composer: (desktop, onPosted) => (
          <>
            {data && (
              <>
                {data.readOnly ? (
                  <p>This event is archived and read-only.</p>
                ) : (
                  <CommentForm
                    compact={desktop}
                    onPosted={onPosted}
                    liveIdentity={!client.preview}
                    disabled={uncertain || saving}
                    post={{ ...post, comments }}
                    viewer={person(data.viewer)}
                    state={{
                      liked: false,
                      comments: [],
                      draft,
                      visibleCount: 20,
                      expandedReplies: expanded,
                      replyTo: reply,
                    }}
                    dispatch={dispatch}
                    textareaRef={text}
                    submitComment={async (body, replyTo) => {
                      setSaving(true);
                      cancelOlderRead();
                      const version = generation.current;
                      try {
                        let response: Response;
                        try {
                          response = await client.request(
                            `/api/posts/${post.id}/comments`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                body,
                                ...(replyTo ? { replyTo } : {}),
                              }),
                              cache: "no-store",
                              signal: AbortSignal.timeout(30_000),
                            },
                          );
                        } catch {
                          setUncertain(true);
                          throw Error(
                            "The result is uncertain. Reload the conversation to check before trying again.",
                          );
                        }
                        const result = await response.json().catch(() => null);
                        if (!response.ok || !result?.id) {
                          if (response.status >= 500 || response.ok)
                            setUncertain(true);
                          throw Error(
                            result?.error ??
                              "Couldn’t confirm this comment. Reload the conversation to check.",
                          );
                        }
                        try {
                          const latest = await read();
                          if (generation.current !== version) return result.id;
                          setData((current) =>
                            current
                              ? {
                                  ...latest,
                                  nextCursor: current.nextCursor,
                                  comments: mergeComments(
                                    current.comments,
                                    latest.comments,
                                  ),
                                }
                              : latest,
                          );
                        } catch {
                          if (generation.current !== version) return result.id;
                          setError(
                            "Your comment was saved, but the conversation couldn’t refresh. Reopen it to see the latest comments.",
                          );
                        }
                        return result.id;
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                )}
              </>
            )}
            <footer className="margin-conversation-footer">
              {data?.likeCount !== undefined && (
                <span data-like-count>
                  <Heart aria-hidden="true" fill="currentColor" />
                  {data.likeCount} {data.likeCount === 1 ? "like" : "likes"}
                </span>
              )}
              <span>
                Disappears{" "}
                <time dateTime={post.expiresAt}>
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "America/Los_Angeles",
                  }).format(new Date(post.expiresAt))}
                </time>
              </span>
            </footer>
          </>
        ),
      }}
    />
  );
}
