"use client";

import Image from "next/image";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { DialogDescription } from "@/components/ui/dialog";
import type { PostMedia } from "@/features/feed/schema";
import { cn } from "@/lib/utils";

/** Descriptions remain alternative/hover text; only explicit captions are visible. */
export function PhotoViewerFigure({
  photo,
  sizes,
  className,
  onPrevious,
  onNext,
  privateMedia = false,
}: {
  photo: PostMedia;
  sizes: string;
  className?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  privateMedia?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const swipable = Boolean(onPrevious || onNext);
  function startSwipe(event: PointerEvent<HTMLImageElement>) {
    if (
      !swipable ||
      event.pointerType !== "touch" ||
      !event.isPrimary ||
      (window.visualViewport?.scale ?? 1) !== 1
    ) {
      touch.current = null;
      return;
    }
    touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function finishSwipe(event: PointerEvent<HTMLImageElement>) {
    const start = touch.current;
    touch.current = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      (window.visualViewport?.scale ?? 1) !== 1
    )
      return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (
      Math.abs(horizontal) < 48 ||
      Math.abs(horizontal) <= Math.abs(vertical) * 1.5
    )
      return;
    if (horizontal > 0) onPrevious?.();
    else onNext?.();
  }
  useLayoutEffect(() => {
    const figure = root.current;
    const caption = figure?.querySelector("figcaption:not(.sr-only)");
    if (!figure) return;
    const query = window.matchMedia?.("(min-width: 1024px)");
    const fit = () => {
      if (!query?.matches) {
        figure.style.removeProperty("--photo-viewer-image-height");
        return;
      }
      if (!figure.clientHeight) return;
      // Reserve the caption, its 12px gap and 24px breathing room. The image
      // then grows proportionally inside the remaining desktop viewing area.
      const available = Math.max(
        80,
        figure.clientHeight -
          (caption ? caption.getBoundingClientRect().height + 36 : 0),
      );
      figure.style.setProperty("--photo-viewer-image-height", `${available}px`);
    };
    fit();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(figure);
    if (caption) observer?.observe(caption);
    window.addEventListener("resize", fit);
    query?.addEventListener?.("change", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
      query?.removeEventListener?.("change", fit);
    };
  }, [photo.caption]);
  return (
    <figure
      ref={root}
      data-swipe={swipable || undefined}
      className={cn("margin-photo-viewer-figure", className)}
      style={
        {
          "--viewer-photo-ratio": photo.image.width / photo.image.height,
        } as CSSProperties
      }
    >
      <Image
        {...photo.image}
        alt={photo.description}
        title={photo.description}
        sizes={sizes}
        loading="eager"
        draggable={false}
        onPointerDown={startSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={() => {
          touch.current = null;
        }}
        unoptimized={privateMedia || photo.image.src.startsWith("blob:")}
      />
      <DialogDescription asChild>
        <figcaption
          className={photo.caption ? "margin-photo-caption" : "sr-only"}
        >
          {photo.caption || photo.description}
        </figcaption>
      </DialogDescription>
    </figure>
  );
}
