"use client";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import {
  previewMessage,
  type FriendPost,
} from "@/features/local-preview/model";

export function DeletePostButton({
  post,
  onDeleted,
}: {
  post: FriendPost;
  onDeleted: () => void;
}) {
  const preview = usePreview();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  const deleted = useRef(false);
  if (post.author.id !== preview.bootstrap.viewerId) return null;
  return (
    <Dialog
      open={confirming}
      onOpenChange={(open) => {
        setConfirming(open);
        setError("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="margin-post-delete"
          aria-label="Delete post"
        >
          <Trash2 aria-hidden="true" strokeWidth={1.5} />
          Delete post
        </Button>
      </DialogTrigger>
      {confirming && (
        <DialogContent
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (deleted.current) {
              event.preventDefault();
              requestAnimationFrame(() =>
                document.getElementById("recent-posts-title")?.focus(),
              );
            }
          }}
        >
          <DialogTitle>Delete this post?</DialogTitle>
          <DialogDescription>
            The post and its conversation will be removed. Photographs already
            in your gallery will stay.
          </DialogDescription>
          <div className="margin-form-actions">
            <Button
              ref={cancel}
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Keep post
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  deleted.current = true;
                  preview.deletePost(post.id);
                  setConfirming(false);
                  onDeleted();
                } catch (error) {
                  deleted.current = false;
                  setError(previewMessage(error));
                }
              }}
            >
              Delete post
            </Button>
          </div>
          {error && (
            <p role="alert" className="margin-field-hint">
              {error}
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
