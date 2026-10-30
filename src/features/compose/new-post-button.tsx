"use client";

import { Plus } from "lucide-react";
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
  disabled = false,
}: {
  variant?: "button" | "header";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const header = variant === "header";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          variant={variant === "button" ? "outline" : "ghost"}
          size={header ? "icon" : "default"}
          className={
            {
              button: "margin-new-post-button",
              header: "margin-mobile-compose",
            }[variant]
          }
          aria-label="New Post"
        >
          <>
            <Plus aria-hidden="true" strokeWidth={1.5} />
            <span className={header ? "sr-only" : "margin-deferred-label"}>
              New Post
            </span>
          </>
        </Button>
      </DialogTrigger>
      {open && <PostComposer onComplete={() => setOpen(false)} />}
    </Dialog>
  );
}
