"use client";

import { ImagePlus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
const PostComposer = dynamic(
  () =>
    import("@/features/compose/post-composer").then(
      (module) => module.PostComposer,
    ),
  { ssr: false },
);

/** Reusable compose entry point for the local application. */
export function NewPostButton({
  variant = "button",
  open: controlledOpen,
  onOpenChange,
  initialPhotoFile,
  disabled = false,
}: {
  variant?: "button" | "header" | "prompt" | "photo";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPhotoFile?: File;
  disabled?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const header = variant === "header";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          variant={variant === "button" ? "outline" : "ghost"}
          size={header || variant === "photo" ? "icon" : "default"}
          className={
            {
              button: "margin-new-post-button",
              header: "margin-mobile-compose",
              prompt: "margin-feed-compose-prompt",
              photo: "margin-feed-compose-photo",
            }[variant]
          }
          aria-label={
            variant === "prompt"
              ? undefined
              : variant === "photo"
                ? "New photo post"
                : "New Post"
          }
        >
          {variant === "prompt" ? (
            "Share a thought…"
          ) : variant === "photo" ? (
            <ImagePlus aria-hidden="true" strokeWidth={1.5} />
          ) : (
            <>
              <Plus aria-hidden="true" strokeWidth={1.5} />
              <span className={header ? "sr-only" : "margin-deferred-label"}>
                New Post
              </span>
            </>
          )}
        </Button>
      </DialogTrigger>
      {open && (
        <PostComposer
          startWithPhoto={variant === "photo" || !!initialPhotoFile}
          initialPhotoFile={initialPhotoFile}
          onComplete={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
