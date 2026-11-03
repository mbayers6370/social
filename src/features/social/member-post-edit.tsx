"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "@/components/margin-icons";
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
export function MemberPostEdit({
  post,
}: {
  post: { id: string; body: string };
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(post.body);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!working) {
          if (value) setBody(post.body);
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
      <DialogContent showCloseButton={!working}>
        <DialogTitle>Edit post</DialogTitle>
        <DialogDescription>
          Your post keeps its original expiry date. The daily post and link
          limits still apply.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (working) return;
            setWorking(true);
            setError("");
            try {
              await requestMember(
                client,
                `/api/posts/${encodeURIComponent(post.id)}`,
                memberJson("PATCH", { body }),
              );
              setOpen(false);
              memberChanged();
              router.refresh();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Your post could not be saved. Your changes are still here.",
              );
            } finally {
              setWorking(false);
            }
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
      </DialogContent>
    </Dialog>
  );
}
