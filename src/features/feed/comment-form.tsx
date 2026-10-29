"use client";

import { createLocalId } from "@/lib/local-id";

import { useId, useState, type Dispatch } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { commentInputSchema, type CommentInput, type FeedPost } from "./schema";
import type { PreviewAction, PreviewPostState } from "./state";

export function CommentForm({
  post,
  state,
  dispatch,
  textareaRef,
  compact = false,
  onPosted,
}: {
  post: FeedPost;
  state: PreviewPostState;
  dispatch: Dispatch<PreviewAction>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  onPosted?: (commentId: string) => void;
}) {
  const id = useId();
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<CommentInput>({
    resolver: zodResolver(commentInputSchema),
    defaultValues: { body: state.draft },
  });
  // Reopening always starts inline, including when a draft has been retained.
  // Focusing the existing textarea reveals the draft without remounting it.
  const expanded = editing || Boolean(errors.body);
  const field = register("body", {
    onChange: (event) => {
      setSubmitted(false);
      dispatch({ type: "draft", postId: post.id, body: event.target.value });
    },
  });
  return (
    <form
      className="margin-comment-form"
      data-compact={compact}
      data-expanded={expanded}
      onFocusCapture={() => setEditing(true)}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !getValues("body").trim() &&
          !state.replyTo
        )
          setEditing(false);
      }}
      noValidate
      onSubmit={handleSubmit(({ body }) => {
        const createdAt = new Date().toISOString();
        const commentId = `local-${createLocalId()}`;
        dispatch({
          type: "comment",
          postId: post.id,
          total: post.comments.length + state.comments.length + 1,
          comment: {
            id: commentId,
            author: {
              id: "local-viewer",
              name: "You",
              initials: "YO",
              tone: "paper",
            },
            body,
            createdAt,
            ...(state.replyTo ? { replyTo: state.replyTo.id } : {}),
          },
        });
        reset({ body: "" });
        setSubmitted(true);
        onPosted?.(commentId);
      })}
    >
      {state.replyTo && (
        <div className="margin-reply-target">
          <span>Replying to {state.replyTo.name}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            onClick={() => {
              dispatch({ type: "reply", postId: post.id, replyTo: null });
              textareaRef.current?.focus({ preventScroll: true });
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      <Label htmlFor={id}>
        {state.replyTo ? `Reply to ${state.replyTo.name}` : "Add a comment"}
      </Label>
      <div className="margin-comment-input" data-field>
        <textarea
          {...field}
          ref={(node) => {
            field.ref(node);
            textareaRef.current = node;
          }}
          id={id}
          rows={expanded ? (compact ? 2 : 3) : 1}
          maxLength={2000}
          placeholder={
            post.comments.length
              ? "Add a comment…"
              : `Write to ${post.author.name.split(" ")[0]}…`
          }
          aria-invalid={Boolean(errors.body)}
          aria-describedby={`${id}-hint${errors.body ? ` ${id}-error` : ""}`}
        />
        {expanded && (
          <Button type="submit" className="margin-comment-submit">
            Post
          </Button>
        )}
      </div>
      <span id={`${id}-hint`} className="sr-only">
        Focus to expand the editor. Local preview only. Up to 2,000 characters.
        Your comment will not be sent or saved.
      </span>
      {errors.body && (
        <FieldError id={`${id}-error`}>{errors.body.message}</FieldError>
      )}
      <p role="status" aria-live="polite" className="margin-status">
        {submitted
          ? "Comment added to this local preview. It isn’t saved."
          : null}
      </p>
    </form>
  );
}
