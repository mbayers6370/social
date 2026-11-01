"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "./post-content";
import { relativeTime } from "./format";
import type { CommentThread } from "./comment-threads";
import type { FeedComment, Person } from "./schema";
import { PersonLink } from "@/components/shared/person-link";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { commentInputSchema } from "./schema";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SafetyReportButton } from "@/features/safety/report-button";

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
      [comment, ...replies].map((item) => [item.id, item.author] as const),
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
  authors: Map<string, Person>;
}) {
  const repliesId = useId();
  const count = thread.replies.length;
  return (
    <li className="margin-comment-thread">
      <CommentRow
        comment={thread.comment}
        parentAuthor={
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
                  parentAuthor={
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
  parentAuthor,
  postId,
  postAuthorId,
  referenceTime,
  onReply,
}: RowProps & {
  comment: FeedComment;
  parentAuthor?: Person;
}) {
  const preview = useOptionalPreview();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState("");
  const own =
    Boolean(preview) && comment.author.id === preview?.bootstrap.viewerId;
  const author = own
    ? (preview!.state.profiles.find(
        (profile) => profile.person.id === preview!.bootstrap.viewerId,
      )?.person ?? comment.author)
    : comment.author;
  const editButton = useRef<HTMLButtonElement>(null);
  const deleted = useRef<HTMLParagraphElement>(null);
  const restoreEditorFocus = () =>
    requestAnimationFrame(() => editButton.current?.focus());
  const inputId = useId();
  return (
    <div className="margin-comment" id={`comment-${postId}-${comment.id}`}>
      <Avatar person={author} small linked />
      <div className="margin-comment-main">
        <div className="margin-comment-meta">
          <strong>
            <PersonLink person={author}>{author.name}</PersonLink>
          </strong>
          {author.id === postAuthorId ? (
            <span className="margin-author-label">Author</span>
          ) : (
            <time dateTime={comment.createdAt}>
              {relativeTime(comment.createdAt, referenceTime)}
            </time>
          )}
          {comment.editedAt && !comment.deletedAt && (
            <span className="margin-comment-edited">Edited</span>
          )}
        </div>
        {comment.replyTo && (
          <span className="margin-reply-context">
            In reply to{" "}
            {parentAuthor ? (
              <PersonLink person={parentAuthor}>{parentAuthor.name}</PersonLink>
            ) : (
              "a comment"
            )}
          </span>
        )}
        {comment.deletedAt ? (
          <p ref={deleted} tabIndex={-1} className="margin-comment-deleted">
            Comment deleted.
          </p>
        ) : editing ? (
          <form
            className="margin-comment-editor"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = commentInputSchema.safeParse({ body });
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
              preview?.dispatchInteraction({
                type: "edit-comment",
                postId,
                commentId: comment.id,
                body: parsed.data.body,
                at: new Date().toISOString(),
              });
              setEditing(false);
              restoreEditorFocus();
            }}
          >
            <label className="sr-only" htmlFor={inputId}>
              Edit your comment
            </label>
            <textarea
              id={inputId}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={3}
              autoFocus
            />
            {error && <p role="alert">{error}</p>}
            <div className="margin-form-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  restoreEditorFocus();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        ) : (
          <p>{comment.body}</p>
        )}
        {!comment.deletedAt && !editing && (
          <div
            className="margin-comment-actions"
            role="group"
            aria-label={`Actions for ${author.name}’s comment`}
          >
            <Button
              variant="ghost"
              className="margin-reply"
              aria-label={`Reply to ${author.name}`}
              onClick={() => onReply({ ...comment, author })}
            >
              Reply
            </Button>
            {own && (
              <>
                <Button
                  ref={editButton}
                  variant="ghost"
                  onClick={() => {
                    setBody(comment.body);
                    setError("");
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </>
            )}
            <SafetyReportButton
              target={{
                kind: "comment",
                id: comment.id,
                personId: author.id,
                label: `Comment by ${author.name}`,
              }}
            />
          </div>
        )}
        <Dialog open={deleting} onOpenChange={setDeleting}>
          <DialogContent
            onCloseAutoFocus={(event) => {
              if (deleted.current) {
                event.preventDefault();
                deleted.current.focus({ preventScroll: true });
              }
            }}
          >
            <DialogTitle>Delete your comment?</DialogTitle>
            <DialogDescription>
              Your words will be removed and replaced with a deleted
              placeholder. Replies stay in the conversation.
            </DialogDescription>
            <div className="margin-form-actions">
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  preview?.dispatchInteraction({
                    type: "delete-comment",
                    postId,
                    commentId: comment.id,
                    at: new Date().toISOString(),
                  });
                  setDeleting(false);
                }}
              >
                Delete comment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
