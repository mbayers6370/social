"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Flag, MoreHorizontal } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { SafetyReportButton } from "@/features/safety/report-button";
import type { PreviewThread } from "./schema";

/** A disclosure keeps ordinary button navigation and the existing action dialogs. */
export function ConversationActions({
  thread,
  actions,
  triggerRef,
}: {
  thread: PreviewThread;
  actions?: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="margin-message-options"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={(node) => {
          trigger.current = node;
          if (triggerRef) triggerRef.current = node;
        }}
        variant="ghost"
        size="icon"
        aria-label="Conversation options"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal aria-hidden="true" />
      </Button>
      {/* Keep action dialogs mounted when selecting an item closes the panel. */}
      <div
        ref={panel}
        id={id}
        hidden={!open}
        className="margin-message-options-panel"
        role="group"
        aria-label="Conversation actions"
        onClick={(event) => {
          if ((event.target as Element).closest("button")) setOpen(false);
        }}
      >
        {actions ?? (
          <>
            <SafetyReportButton
              target={{
                kind: "message",
                id: thread.id,
                personId: thread.contact.id,
                label: `Conversation with ${thread.contact.name}`,
              }}
              onCloseAutoFocus={restoreFocus}
              trigger={
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  <Flag aria-hidden="true" />
                  Report conversation
                </Button>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
