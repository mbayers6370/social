"use client";
import type { ReactNode } from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** One responsive editing surface for personal and Space posts. */
export function ComposerSurface({
  inline,
  feed,
  onActivate,
  onReturnFocus,
  onCancel,
  children,
}: {
  inline: boolean;
  feed: boolean;
  onActivate: () => void;
  onReturnFocus?: () => void;
  onCancel?: () => void;
  children: ReactNode;
}) {
  if (inline)
    return (
      <section
        className="margin-compose-inline"
        aria-label="New Post"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented && onCancel) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      >
        {children}
      </section>
    );
  return (
    <DialogContent
      className={cn("margin-compose-dialog", feed && "margin-compose-feed")}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        onActivate();
      }}
      onCloseAutoFocus={
        onReturnFocus
          ? (event) => {
              event.preventDefault();
              onReturnFocus();
            }
          : undefined
      }
    >
      {children}
    </DialogContent>
  );
}
