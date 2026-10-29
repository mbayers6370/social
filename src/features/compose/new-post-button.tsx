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
}: {
  variant?: "button" | "header" | "prompt" | "photo";
}) {
  const [open, setOpen] = useState(false);
  const header = variant === "header";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
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
                : "New post"
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
                New post
              </span>
            </>
          )}
        </Button>
      </DialogTrigger>
      {open && (
        <PostComposer
          startWithPhoto={variant === "photo"}
          onComplete={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
