"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { DialogDescription } from "@/components/ui/dialog";
import type { PostMedia } from "@/features/feed/schema";
import { cn } from "@/lib/utils";

/** Keep the full image and its caption together in every photo dialog. */
export function PhotoViewerFigure({
  photo,
  sizes,
  className,
}: {
  photo: PostMedia;
  sizes: string;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const figure = root.current;
    const caption = figure?.querySelector("figcaption");
    if (!figure || !caption) return;
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
        figure.clientHeight - caption.getBoundingClientRect().height - 36,
      );
      figure.style.setProperty("--photo-viewer-image-height", `${available}px`);
    };
    fit();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(figure);
    observer?.observe(caption);
    window.addEventListener("resize", fit);
    query?.addEventListener?.("change", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
      query?.removeEventListener?.("change", fit);
    };
  }, []);
  return (
    <figure
      ref={root}
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
        sizes={sizes}
        loading="eager"
        unoptimized={photo.image.src.startsWith("blob:")}
      />
      <DialogDescription asChild>
        <figcaption className="margin-photo-caption">
          {photo.description}
        </figcaption>
      </DialogDescription>
    </figure>
  );
}
