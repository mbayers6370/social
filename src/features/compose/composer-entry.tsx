"use client";
import type { ComponentProps, ReactNode, Ref } from "react";
import { Image as ImageIcon } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";

/** Shared feed entry geometry; each audience owns its draft and publishing rules. */
export function ComposerEntry({
  avatar,
  open,
  desktop,
  busy,
  showPrompt = true,
  onOpen,
  promptRef,
  photoRef,
  children,
  className = "",
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  avatar: ReactNode;
  open: boolean;
  desktop: boolean;
  busy?: boolean;
  showPrompt?: boolean;
  onOpen: (photo: boolean) => void;
  promptRef?: Ref<HTMLButtonElement>;
  photoRef?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}) {
  if (!showPrompt && (!open || !desktop)) return <>{children}</>;
  return (
    <div
      {...props}
      className={`margin-feed-composer ${className}`}
      data-expanded={(open && desktop) || undefined}
    >
      {showPrompt && (!open || !desktop) && (
        <>
          {avatar}
          <Button
            ref={promptRef}
            variant="ghost"
            className="margin-feed-compose-prompt"
            disabled={busy}
            aria-expanded={open}
            aria-haspopup={desktop ? undefined : "dialog"}
            onClick={() => onOpen(false)}
          >
            Share a thought…
          </Button>
          <Button
            ref={photoRef}
            variant="ghost"
            size="icon"
            className="margin-feed-compose-photo"
            aria-label="New photo post"
            disabled={busy}
            onClick={() => onOpen(true)}
          >
            <ImageIcon aria-hidden="true" />
          </Button>
        </>
      )}
      {children}
    </div>
  );
}
