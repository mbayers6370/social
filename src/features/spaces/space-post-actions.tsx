"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Flag, Spaces, Close, Trash } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafetyReportButton } from "@/features/safety/report-button";
import type { PostMenuControls } from "@/features/feed/post-options-menu";
import type { SpacePost } from "./contracts";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";

export function SpacePostActions({
  post,
  viewerId,
  inFeed,
  controls,
}: {
  post: SpacePost;
  viewerId?: string;
  inFeed: boolean;
  controls: PostMenuControls;
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const action = useSpaceAction();
  const [removing, setRemoving] = useState(false);
  const [feedError, setFeedError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  async function removeFromFeed() {
    try {
      const response = await client.request(
        `/api/spaces/${post.space!.id}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({ action: "preferences", includeInFeed: false }),
        },
      );
      if (!response.ok)
        throw Error(
          "Couldn’t remove this Space from your Feed. Please try again.",
        );
      if (!client.preview) router.refresh();
      requestAnimationFrame(() =>
        document.getElementById("feed-title")?.focus({ preventScroll: true }),
      );
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Couldn’t change your Feed.",
      );
    }
  }
  return (
    <>
      {post.space && (
        <Link
          href={client.href(`/app/spaces/${post.space.id}`)}
          {...controls.itemProps}
        >
          <Spaces aria-hidden="true" />
          Open Space
        </Link>
      )}
      {post.space && inFeed && (
        <Button
          variant="ghost"
          {...controls.itemProps}
          onClick={() => {
            controls.itemProps.onClick();
            void removeFromFeed();
          }}
        >
          <Close aria-hidden="true" />
          Remove Space from my Feed
        </Button>
      )}
      {viewerId !== post.author.id && (
        <SafetyReportButton
          target={{
            kind: "post",
            id: post.id,
            personId: post.author.id,
            label:
              `Post by ${post.author.name}${post.space ? ` in ${post.space.name}` : ""}`.slice(
                0,
                160,
              ),
          }}
          viewerId={viewerId}
          local={client.preview}
          onCloseAutoFocus={controls.restoreFocus}
          onReport={async (input) => {
            const response = await client.request("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
              cache: "no-store",
              signal: AbortSignal.timeout(30_000),
            });
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              throw Error(
                body?.error ?? "Couldn’t save your report. Please try again.",
              );
            }
          }}
          trigger={
            <Button variant="ghost" {...controls.itemProps}>
              <Flag aria-hidden="true" />
              Report post
            </Button>
          }
        />
      )}
      {viewerId === post.author.id && !post.space?.archived && (
        <Button
          variant="ghost"
          {...controls.itemProps}
          data-destructive="true"
          onClick={() => {
            controls.itemProps.onClick();
            setRemoving(true);
          }}
        >
          <Trash aria-hidden="true" />
          Delete post
        </Button>
      )}
      <Dialog
        open={removing}
        onOpenChange={(open) => {
          if (!action.busy) setRemoving(open);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={!action.busy}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
          onCloseAutoFocus={controls.restoreFocus}
        >
          <DialogTitle>Delete this post?</DialogTitle>
          <DialogDescription>
            The post and its conversation will be removed. Photographs used
            elsewhere are preserved.
          </DialogDescription>
          <Button
            ref={cancel}
            variant="outline"
            disabled={action.busy}
            onClick={() => setRemoving(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={action.busy}
            onClick={async () => {
              if (await action.run(`/api/posts/${post.id}`, "DELETE"))
                setRemoving(false);
            }}
          >
            Confirm deletion
          </Button>
          {action.error && <p role="alert">{action.error}</p>}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(feedError)}
        onOpenChange={(open) => {
          if (!open) setFeedError("");
        }}
      >
        <DialogContent onCloseAutoFocus={controls.restoreFocus}>
          <DialogTitle>Your Feed couldn’t be updated</DialogTitle>
          <DialogDescription>{feedError}</DialogDescription>
          <Button onClick={() => setFeedError("")}>Done</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
