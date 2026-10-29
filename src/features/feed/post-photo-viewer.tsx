"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createLocalId } from "@/lib/local-id";
import { PhotoViewerFigure } from "@/components/shared/photo-viewer-figure";
import type { PostMedia } from "./schema";

export function PostPhotoViewer({
  photos,
  initialIndex,
  postId,
  authorName,
  onClose,
  onRestoreFocus,
}: {
  photos: PostMedia[];
  initialIndex: number;
  postId: string;
  authorName: string;
  onClose: () => void;
  onRestoreFocus: (event: Event) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(true);
  const historyId = useRef<string | null>(null);
  const closing = useRef(false);
  const originalScroll = useRef(window.scrollY);
  const photo = photos[index];
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    if (window.history.state?.marginPostPhoto === historyId.current)
      window.history.back();
  }, []);

  useEffect(() => {
    const id = historyId.current ?? createLocalId();
    historyId.current = id;
    if (window.history.state?.marginPostPhoto !== id)
      window.history.pushState(
        { ...window.history.state, marginPostPhoto: id },
        "",
        `#photo-${postId}-${initialIndex + 1}`,
      );
    const onPop = () => {
      if (window.history.state?.marginPostPhoto !== id) {
        closing.current = true;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [postId, initialIndex]);

  useEffect(() => {
    if (!open) return;
    // Keep arrow navigation working when an end control becomes disabled.
    const navigate = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => Math.min(photos.length - 1, current + 1));
      }
    };
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [open, photos.length]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent
        data-post-photo-viewer
        data-post-id={postId}
        className="margin-post-photo-viewer"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          onRestoreFocus(event);
          window.scrollTo({ top: originalScroll.current, behavior: "instant" });
          onClose();
        }}
      >
        <header className="margin-post-photo-viewer-header">
          <Button variant="ghost" onClick={close}>
            <ChevronLeft aria-hidden="true" />
            Back to post
          </Button>
          <DialogTitle className="sr-only">
            Photographs from {authorName}’s post
          </DialogTitle>
          <span className="margin-field-hint" aria-live="polite">
            {index + 1} of {photos.length}
          </span>
        </header>
        <PhotoViewerFigure
          photo={photo}
          className="margin-post-photo-viewer-stage"
          sizes="(max-width: 639px) calc(100vw - 32px), 1000px"
        />
        <footer className="margin-post-photo-viewer-footer">
          {photos.length > 1 && (
            <div className="margin-post-photo-viewer-actions">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous photograph"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next photograph"
                disabled={index === photos.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
