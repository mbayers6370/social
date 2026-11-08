"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { messageInputSchema, type MessageInput } from "./schema";
export function MessageComposer({
  name,
  notebook = false,
  draft,
  onDraft,
  onSend,
  live = false,
}: {
  name: string;
  notebook?: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (value: string) => void | Promise<void>;
  live?: boolean;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MessageInput>({
    resolver: zodResolver(messageInputSchema),
    defaultValues: { body: draft },
  });
  const field = register("body", {
    onChange: (event) => {
      onDraft(event.target.value);
      setSent(false);
    },
  });

  useLayoutEffect(() => {
    if (textarea.current) {
      fitMessageInput(textarea.current);
      revealFocusedInput(textarea.current);
    }
  }, [draft]);

  useLayoutEffect(() => {
    // Submission disables the field; restore focus after it is enabled again.
    if (sent && !isSubmitting) textarea.current?.focus({ preventScroll: true });
  }, [sent, isSubmitting]);

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    // Refit wrapped drafts after resizing or opening a hidden mobile thread.
    // Ignore height changes from fitting the field itself.
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) {
        width = input.clientWidth;
        fitMessageInput(input);
      }
      revealFocusedInput(input);
    });
    observer.observe(input);
    // Short windows and enlarged text can make the thread itself scroll. Keep
    // its active composer reachable when that container shrinks without moving
    // a reader who is viewing history with the field unfocused.
    const thread = input.closest(".margin-thread");
    if (thread) observer.observe(thread);
    return () => observer.disconnect();
  }, []);

  return (
    <form
      className="margin-message-composer"
      noValidate
      onSubmit={handleSubmit(async ({ body }) => {
        setError("");
        try {
          await onSend(body);
          onDraft("");
          reset({ body: "" });
          setSent(true);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Your message could not be sent. Your draft is still here.",
          );
        }
      })}
    >
      <label htmlFor="message-body" className="sr-only">
        {notebook ? "Note to self" : `Message to ${name}`}
      </label>
      <div className="margin-message-input" data-field>
        <textarea
          {...field}
          ref={(node) => {
            field.ref(node);
            textarea.current = node;
          }}
          id="message-body"
          rows={1}
          disabled={isSubmitting}
          maxLength={2000}
          placeholder={
            notebook ? "Write a note…" : `Write to ${name.split(" ")[0]}…`
          }
          onKeyDown={(event) => {
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229
            )
              return;
            event.preventDefault();
            if (!isSubmitting && !event.repeat)
              event.currentTarget.form?.requestSubmit();
          }}
          aria-invalid={Boolean(errors.body)}
          aria-describedby={`message-shortcut message-hint${errors.body ? " message-error" : ""}`}
        />
        <Button
          type="submit"
          aria-label={
            notebook
              ? "Save note"
              : live
                ? "Send message"
                : "Add message to local preview"
          }
          disabled={isSubmitting}
          className="margin-send"
        >
          <span>{notebook ? "Save note" : "Send"}</span>
        </Button>
      </div>
      <p id="message-shortcut" className="margin-message-shortcut">
        {notebook ? "Enter to save" : "Enter to send"} · Shift+Enter for a new
        line
      </p>
      <p id="message-hint" className="sr-only">
        Expands up to three lines, then scrolls. Up to 2,000 characters.
        {notebook
          ? live
            ? " Notes are saved privately to your account."
            : " Notes stay in this tab and clear on refresh."
          : live
            ? " Messages are sent to this conversation."
            : " This preview does not send messages."}
      </p>
      {errors.body && (
        <FieldError id="message-error">
          {notebook
            ? errors.body.message?.replace("message", "note")
            : errors.body.message}
        </FieldError>
      )}
      {error && <FieldError>{error}</FieldError>}
      <p role="status" className="margin-status">
        {sent
          ? notebook
            ? live
              ? "Note saved."
              : "Note saved in this tab."
            : live
              ? "Message sent."
              : "Added to the local preview."
          : ""}
      </p>
    </form>
  );
}

function fitMessageInput(input: HTMLTextAreaElement) {
  if (!input.clientWidth) return;
  const scrollTop = input.scrollTop;
  // Measure natural content height; CSS caps the visible area at three lines.
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
  input.scrollTop = scrollTop;
}

function revealFocusedInput(input: HTMLTextAreaElement) {
  if (document.activeElement === input)
    input.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
