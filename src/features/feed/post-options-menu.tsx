"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";

export type PostMenuControls = {
  itemProps: { role: "menuitem"; tabIndex: number; onClick: () => void };
  restoreFocus: (event: Event) => void;
};

/** Action dialogs remain mounted while their menu is closed. */
export function PostOptionsMenu({
  name,
  children,
}: {
  name: string;
  children: (controls: PostMenuControls) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const last = useRef(false);
  const items = () => [
    ...(panel.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not(:disabled)',
    ) ?? []),
  ];
  const close = () => setOpen(false);
  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    panel.current.dataset.side =
      trigger.current.getBoundingClientRect().bottom +
        panel.current.offsetHeight +
        16 >
      innerHeight - 80
        ? "above"
        : "below";
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const choices = items();
    choices[last.current ? choices.length - 1 : 0]?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="margin-post-options"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        aria-label={`Post options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          last.current = false;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            last.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal aria-hidden="true" />
      </Button>
      <div
        ref={panel}
        id={id}
        role="menu"
        aria-label={`Options for ${name}’s post`}
        hidden={!open}
        className="margin-post-options-panel"
        onKeyDown={(event) => {
          // Dialog portals bubble through this tree after the menu has closed.
          if (!open || !event.currentTarget.contains(event.target as Node))
            return;
          const choices = items();
          const index = choices.indexOf(document.activeElement as HTMLElement);
          const destination =
            event.key === "ArrowDown"
              ? (index + 1) % choices.length
              : event.key === "ArrowUp"
                ? (index - 1 + choices.length) % choices.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? choices.length - 1
                    : null;
          if (destination !== null) {
            event.preventDefault();
            choices[destination]?.focus();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            trigger.current?.focus();
          } else if (event.key === "Tab") {
            event.preventDefault();
            const stops = [
              ...document.querySelectorAll<HTMLElement>(
                'a[href],button,input,textarea,select,[tabindex="0"]',
              ),
            ].filter(
              (node) =>
                node.tabIndex >= 0 &&
                node.getClientRects().length &&
                !node.hasAttribute("disabled") &&
                !panel.current?.contains(node),
            );
            const next = event.shiftKey
              ? trigger.current
              : stops[stops.indexOf(trigger.current!) + 1];
            close();
            next?.focus();
          } else if (
            event.key === " " &&
            event.target instanceof HTMLAnchorElement
          ) {
            event.preventDefault();
            event.target.click();
          }
        }}
      >
        {children({
          itemProps: { role: "menuitem", tabIndex: -1, onClick: close },
          restoreFocus: (event) => {
            event.preventDefault();
            const target = trigger.current?.isConnected
              ? trigger.current
              : document.getElementById("feed-title");
            target?.focus({ preventScroll: true });
          },
        })}
      </div>
    </div>
  );
}
