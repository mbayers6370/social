"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import dynamic from "next/dynamic";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { usePreview } from "@/features/local-preview/provider";
import { containsPostLink } from "@/lib/platform-rules";
import {
  localPostingEligibility,
  previewMessage,
} from "@/features/local-preview/model";
import { validateLocalPhoto } from "@/features/local-preview/upload";
import { ComposerEntry } from "./composer-entry";
import { useComposerLayout } from "./use-composer-layout";

const PostComposer = dynamic(
  () => import("./post-composer").then((module) => module.PostComposer),
  { ssr: false },
);

/** Lightweight feed entry; the full composer loads only after activation. */
export function FeedComposer() {
  const { state, bootstrap, now, draft } = usePreview();
  const [open, setOpen] = useState(false);
  const desktop = useComposerLayout();
  const [startWithPhoto, setStartWithPhoto] = useState(false);
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const promptButton = useRef<HTMLButtonElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<"prompt" | "photo">("prompt");
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
      // Validate the file before opening the picker.
      await validateLocalPhoto(files[0]);
      if (!alive.current) return;
      const updatedReason = dropAllowance(current.current);
      if (updatedReason) {
        setNotice(updatedReason);
        return;
      }
      setFile(files[0]);
      returnTo.current = "prompt";
      setStartWithPhoto(true);
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
  function restoreFocus() {
    (returnTo.current === "photo"
      ? photoButton.current
      : promptButton.current
    )?.focus({ preventScroll: true });
  }
  function closeComposer() {
    setOpen(false);
    setFile(undefined);
    if (desktop) requestAnimationFrame(restoreFocus);
  }

  return (
    <Dialog
      open={open && !desktop}
      onOpenChange={(next) => {
        if (!next) closeComposer();
      }}
    >
      <ComposerEntry
        avatar={<Avatar person={profile.person} linked />}
        open={open}
        desktop={desktop}
        busy={checking}
        promptRef={promptButton}
        photoRef={photoButton}
        onOpen={(photo) => {
          returnTo.current = photo ? "photo" : "prompt";
          setStartWithPhoto(photo);
          setNotice("");
          setOpen(true);
        }}
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
        {open && (
          <PostComposer
            inline={desktop}
            feed
            startWithPhoto={startWithPhoto}
            initialPhotoFile={file}
            onComplete={closeComposer}
            onReturnFocus={restoreFocus}
          />
        )}
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
      </ComposerEntry>
    </Dialog>
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
