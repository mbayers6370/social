"use client";

import { createLocalId } from "@/lib/local-id";

import { useId, useState, type Dispatch } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Close } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { PersonLink } from "@/components/shared/person-link";
import {
  commentInputSchema,
  type CommentInput,
  type FeedPost,
  type Person,
} from "./schema";
import type { PreviewAction, PreviewPostState } from "./state";

export function CommentForm({
  post,
  viewer,
  state,
  dispatch,
  textareaRef,
  compact = false,
  onPosted,
  submitComment,
  disabled = false,
  liveIdentity = Boolean(submitComment),
}: {
  disabled?: boolean;
  liveIdentity?: boolean;
  submitComment?: (body: string, replyTo: string | null) => Promise<string>;
  post: FeedPost;
  viewer: Person;
  state: PreviewPostState;
  dispatch: Dispatch<PreviewAction>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  onPosted?: (commentId: string) => void;
}) {
  const id = useId();
  const replyAuthor = [...post.comments, ...state.comments].find(
    (comment) => comment.id === state.replyTo?.id,
  )?.author;
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting },
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
      onSubmit={handleSubmit(async ({ body }) => {
        if (submitComment) {
          try {
            const id = await submitComment(body, state.replyTo?.id ?? null);
            reset({ body: "" });
            dispatch({ type: "draft", postId: post.id, body: "" });
            dispatch({ type: "reply", postId: post.id, replyTo: null });
            setSubmitted(true);
            onPosted?.(id);
          } catch (error) {
            setError("root", {
              message:
                error instanceof Error
                  ? error.message
                  : "Couldn’t save this comment.",
            });
          }
          return;
        }
        const createdAt = new Date().toISOString();
        const commentId = `local-${createLocalId()}`;
        dispatch({
          type: "comment",
          postId: post.id,
          total: post.comments.length + state.comments.length + 1,
          comment: {
            id: commentId,
            author: viewer,
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
          <span>
            Replying to{" "}
            {replyAuthor ? (
              <PersonLink live={liveIdentity} person={replyAuthor}>
                {state.replyTo.name}
              </PersonLink>
            ) : (
              state.replyTo.name
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            onClick={() => {
              dispatch({ type: "reply", postId: post.id, replyTo: null });
              textareaRef.current?.focus({ preventScroll: true });
            }}
          >
            <Close aria-hidden="true" />
          </Button>
        </div>
      )}
      <Label htmlFor={id} className="sr-only">
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
          disabled={disabled || isSubmitting}
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
          <Button
            disabled={isSubmitting || disabled}
            type="submit"
            className="margin-comment-submit"
          >
            Post
          </Button>
        )}
      </div>
      <span id={`${id}-hint`} className="sr-only">
        {submitComment
          ? "Up to 2,000 characters. Comments expire with the post."
          : "Focus to expand the editor. Local preview only. Up to 2,000 characters. Your comment will not be sent or saved."}
      </span>
      {errors.root && <FieldError>{errors.root.message}</FieldError>}
      {errors.body && (
        <FieldError id={`${id}-error`}>{errors.body.message}</FieldError>
      )}
      <p role="status" aria-live="polite" className="margin-status">
        {submitted
          ? submitComment
            ? "Comment saved."
            : "Comment added to this local preview. It isn’t saved."
          : null}
      </p>
    </form>
  );
}
