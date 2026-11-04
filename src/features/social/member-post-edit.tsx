"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSpaceClient } from "@/features/spaces/client";
import { requestMember, memberJson, memberChanged } from "./member-client";
import { PostPhotoDeleteOption } from "@/features/profile/post-photo-delete-option";
export function MemberPostEdit({
  post,
}: {
  post: { id: string; body: string; photos?: readonly { id: string }[] };
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(post.body);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deletePhotos, setDeletePhotos] = useState(false);
  const keepPost = useRef<HTMLButtonElement>(null);
  const deletePost = useRef<HTMLButtonElement>(null);
  const deleted = useRef(false);

  useEffect(() => {
    if (confirming) keepPost.current?.focus();
    else deletePost.current?.focus();
  }, [confirming]);

  async function change(method: "PATCH" | "DELETE") {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      await requestMember(
        client,
        `/api/posts/${encodeURIComponent(post.id)}`,
        method === "PATCH"
          ? memberJson(method, { body })
          : deletePhotos
            ? memberJson(method, { deletePhotos: true })
            : { method },
      );
      deleted.current = method === "DELETE";
      setOpen(false);
      memberChanged();
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : method === "DELETE"
            ? "Your post could not be deleted. Please try again."
            : "Your post could not be saved. Your changes are still here.",
      );
    } finally {
      setWorking(false);
    }
  }

  function returnToEdit() {
    setConfirming(false);
    setError("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!working) {
          if (value) {
            setBody(post.body);
            setConfirming(false);
            setDeletePhotos(false);
            setError("");
            deleted.current = false;
          }
          setOpen(value);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="margin-post-edit-trigger">
          <Edit aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!working}
        role={confirming ? "alertdialog" : "dialog"}
        onEscapeKeyDown={(event) => {
          if (confirming) {
            event.preventDefault();
            if (!working) returnToEdit();
          }
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
        {confirming ? (
          <>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              The post and its conversation will be removed. Photographs used
              elsewhere are preserved.
            </DialogDescription>
            {!!post.photos?.length && (
              <PostPhotoDeleteOption
                checked={deletePhotos}
                disabled={working}
                onChange={setDeletePhotos}
              />
            )}
            {error && <p role="alert">{error}</p>}
            <div className="margin-form-actions">
              <Button
                ref={keepPost}
                variant="outline"
                disabled={working}
                onClick={returnToEdit}
              >
                Keep post
              </Button>
              <Button
                variant="destructive"
                disabled={working}
                onClick={() => void change("DELETE")}
              >
                {working ? "Deleting…" : "Delete post"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Your post keeps its original expiry date. The daily post and link
              limits still apply.
            </DialogDescription>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void change("PATCH");
              }}
            >
              <Label htmlFor={id}>Your post</Label>
              <textarea
                id={id}
                className="margin-compose-body"
                maxLength={3000}
                rows={6}
                disabled={working}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              {error && <p role="alert">{error}</p>}
              <div className="margin-form-actions">
                <Button
                  ref={deletePost}
                  variant="ghost"
                  className="margin-post-edit-delete"
                  disabled={working}
                  onClick={() => {
                    setError("");
                    setConfirming(true);
                  }}
                >
                  <Trash aria-hidden="true" />
                  Delete post
                </Button>
                <Button
                  variant="outline"
                  disabled={working}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={working}>
                  Save changes
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
