"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Avatar } from "@/features/feed/post-content";
import { usePreview } from "@/features/local-preview/provider";
import { containsPostLink } from "@/lib/platform-rules";
import {
  localPostingEligibility,
  previewMessage,
} from "@/features/local-preview/model";
import { validateLocalPhoto } from "@/features/local-preview/upload";
import { NewPostButton } from "./new-post-button";

/** Lightweight feed entry; the full composer loads only after activation. */
export function FeedComposer() {
  const { state, bootstrap, now, draft } = usePreview();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const alive = useRef(false);
  const current = useRef({ state, bootstrap, now, draft });
  useEffect(() => {
    current.current = { state, bootstrap, now, draft };
  }, [state, bootstrap, now, draft]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function acceptsDrop(event: DragEvent<HTMLDivElement>) {
    return (
      window.matchMedia("(min-width: 1024px)").matches &&
      event.dataTransfer.types.includes("Files")
    );
  }
  async function dropPhoto(event: DragEvent<HTMLDivElement>) {
    if (!acceptsDrop(event)) return;
    event.preventDefault();
    setDragging(false);
    if (busy.current || open) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setNotice("Drop one photograph at a time.");
      return;
    }
    const reason = dropAllowance(current.current);
    if (reason) {
      setNotice(reason);
      return;
    }
    busy.current = true;
    setChecking(true);
    setNotice("");
    try {
      // Validate the file here; the author supplies its actual description in the picker.
      await validateLocalPhoto(files[0], "Dropped photograph");
      if (!alive.current) return;
      const updatedReason = dropAllowance(current.current);
      if (updatedReason) {
        setNotice(updatedReason);
        return;
      }
      setFile(files[0]);
      setOpen(true);
    } catch (error) {
      if (alive.current) setNotice(previewMessage(error));
    } finally {
      busy.current = false;
      if (alive.current) setChecking(false);
    }
  }
  const profile = state.profiles.find(
    (item) => item.person.id === bootstrap.viewerId,
  )!;

  return (
    <div
      className="margin-feed-composer"
      role="group"
      aria-label="Create a post"
      aria-busy={checking}
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        if (!acceptsDrop(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = dropAllowance(current.current)
          ? "none"
          : "copy";
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={dropPhoto}
    >
      <Avatar person={profile.person} linked />
      <NewPostButton
        variant="prompt"
        disabled={checking}
        open={open}
        initialPhotoFile={file}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFile(undefined);
        }}
      />
      <NewPostButton variant="photo" disabled={checking} />
      {(dragging || checking) && (
        <p className="margin-feed-drop-notice" role="status">
          {checking
            ? "Checking photograph…"
            : dropAllowance({ state, bootstrap, now, draft }) ||
              "Drop a photograph to start a post."}
        </p>
      )}
      {notice && (
        <p className="margin-feed-drop-notice" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}

function dropAllowance({
  state,
  bootstrap,
  now,
  draft,
}: Pick<
  ReturnType<typeof usePreview>,
  "state" | "bootstrap" | "now" | "draft"
>) {
  const photoIds = draft.photoIds ?? [];
  if (photoIds.length >= 3)
    return "This draft already has three photographs. Remove one before adding another.";
  const allowance = localPostingEligibility(
    state,
    bootstrap.viewerId,
    new Date(now),
    containsPostLink({ body: draft.body, url: "" }),
    photoIds.length + 1,
    undefined,
    photoIds,
  );
  return allowance.allowed ? "" : allowance.reason;
}
