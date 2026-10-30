"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";

/** The product's card turn, using only a fictional public discussion. */
export function WelcomePost({
  children,
  discussion,
}: {
  children: ReactNode;
  discussion: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [hintVisible, setHintVisible] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const button = trigger.current;
    if (!button || !showHint || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setHintVisible(entry.isIntersecting && entry.intersectionRatio >= 1),
      { threshold: [0, 1] },
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, [showHint]);

  useEffect(() => {
    if (open) back.current?.focus({ preventScroll: true });
    else if (wasOpen.current) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <article
      className="margin-welcome-post"
      aria-label="Post by Alex Rowan"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <div className="margin-welcome-post-turn" data-open={open}>
        <div
          className="margin-welcome-post-front"
          inert={open}
          aria-hidden={open}
        >
          {children}
          <button
            ref={trigger}
            type="button"
            className="margin-welcome-post-action"
            aria-label="Open conversation"
            aria-expanded={open}
            aria-controls={id}
            data-hint={showHint ? (hintVisible ? "active" : "idle") : undefined}
            onClick={() => {
              setShowHint(false);
              setOpen(true);
            }}
          >
            <MessageCircle aria-hidden="true" />
            <span
              className="margin-welcome-post-action-label"
              aria-hidden="true"
            >
              Open
            </span>
          </button>
        </div>
        <div
          className="margin-welcome-post-back"
          id={id}
          inert={!open}
          aria-hidden={!open}
        >
          <header className="margin-welcome-conversation-heading">
            <button
              ref={back}
              type="button"
              className="margin-welcome-conversation-back"
              aria-label="Close conversation"
              onClick={() => setOpen(false)}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <span>Conversation</span>
          </header>
          {discussion}
        </div>
      </div>
    </article>
  );
}
