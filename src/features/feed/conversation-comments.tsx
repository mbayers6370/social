"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "./post-content";
import { relativeTime } from "./format";
import type { CommentThread } from "./comment-threads";
import type { FeedComment } from "./schema";

type RowProps = {
  postId: string;
  postAuthorId: string;
  referenceTime: string;
  onReply: (comment: FeedComment) => void;
};

export function ConversationComments({
  threads,
  visibleCount,
  expandedReplies,
  onExpandedChange,
  ...rowProps
}: RowProps & {
  threads: CommentThread[];
  visibleCount: number;
  expandedReplies: readonly string[];
  onExpandedChange: (commentId: string, expanded: boolean) => void;
}) {
  const authors = new Map(
    threads.flatMap(({ comment, replies }) =>
      [comment, ...replies].map((item) => [item.id, item.author.name] as const),
    ),
  );
  return (
    <ol className="margin-comment-list" aria-label="Comments">
      {threads.slice(0, visibleCount).map((thread) => (
        <CommentThreadView
          key={thread.comment.id}
          thread={thread}
          expanded={expandedReplies.includes(thread.comment.id)}
          onExpandedChange={onExpandedChange}
          authors={authors}
          {...rowProps}
        />
      ))}
    </ol>
  );
}

function CommentThreadView({
  thread,
  expanded,
  onExpandedChange,
  authors,
  ...rowProps
}: RowProps & {
  thread: CommentThread;
  expanded: boolean;
  onExpandedChange: (commentId: string, expanded: boolean) => void;
  authors: Map<string, string>;
}) {
  const repliesId = useId();
  const count = thread.replies.length;
  return (
    <li className="margin-comment-thread">
      <CommentRow
        comment={thread.comment}
        parentName={
          thread.comment.replyTo
            ? authors.get(thread.comment.replyTo)
            : undefined
        }
        {...rowProps}
      />
      {count > 0 && (
        <>
          <Button
            variant="ghost"
            className="margin-replies-toggle"
            aria-expanded={expanded}
            aria-controls={repliesId}
            onClick={() => onExpandedChange(thread.comment.id, !expanded)}
          >
            <ChevronDown aria-hidden="true" />
            {expanded
              ? "Hide replies"
              : `Show ${count} ${count === 1 ? "reply" : "replies"}`}
          </Button>
          <ol
            id={repliesId}
            className="margin-comment-replies"
            hidden={!expanded}
            aria-label={`Replies to ${thread.comment.author.name}`}
          >
            {thread.replies.map((comment) => (
              <li key={comment.id}>
                <CommentRow
                  comment={comment}
                  parentName={
                    comment.replyTo ? authors.get(comment.replyTo) : undefined
                  }
                  {...rowProps}
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </li>
  );
}

function CommentRow({
  comment,
  parentName,
  postId,
  postAuthorId,
  referenceTime,
  onReply,
}: RowProps & {
  comment: FeedComment;
  parentName?: string;
}) {
  return (
    <div className="margin-comment" id={`comment-${postId}-${comment.id}`}>
      <Avatar person={comment.author} small />
      <div className="margin-comment-main">
        <div className="margin-comment-meta">
          <strong>{comment.author.name}</strong>
          {comment.author.id === postAuthorId ? (
            <span className="margin-author-label">Author</span>
          ) : (
            <time dateTime={comment.createdAt}>
              {relativeTime(comment.createdAt, referenceTime)}
            </time>
          )}
          <Button
            variant="ghost"
            className="margin-reply"
            aria-label={`Reply to ${comment.author.name}`}
            onClick={() => onReply(comment)}
          >
            Reply
          </Button>
        </div>
        {comment.replyTo && (
          <span className="margin-reply-context">
            In reply to {parentName ?? "a comment"}
          </span>
        )}
        <p>{comment.body}</p>
      </div>
    </div>
  );
}
