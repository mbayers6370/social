"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PostMedia } from "./schema";

const PostPhotoViewer = dynamic(() =>
  import("./post-photo-viewer").then((module) => module.PostPhotoViewer),
);

export function PostPhotos({
  photos,
  postId,
  authorName,
  highPriority = false,
}: {
  photos: PostMedia[];
  postId: string;
  authorName: string;
  highPriority?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const returnTo = useRef<HTMLButtonElement | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const multiple = photos.length > 1;

  useEffect(() => {
    const root = container.current;
    const scroller = strip.current;
    if (!multiple || !root || !scroller) return;
    const updateEdges = () => {
      const previous = String(scroller.scrollLeft > 2);
      const next = String(
        scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
      );
      if (root.dataset.canPrevious !== previous)
        root.dataset.canPrevious = previous;
      if (root.dataset.canNext !== next) root.dataset.canNext = next;
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    scroller.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", updateEdges);
    };
  }, [multiple, photos.length]);

  return (
    <>
      <div
        className="margin-post-photos"
        ref={container}
        data-multiple={multiple}
        data-can-previous="false"
        data-can-next={multiple}
      >
        <div
          ref={strip}
          className="margin-media"
          data-multiple={multiple}
          role="group"
          aria-label={`Photographs from ${authorName}’s post`}
        >
          {photos.map((photo, index) => (
            <button
              key={`${postId}-${index}`}
              type="button"
              className="margin-post-photo"
              style={
                {
                  "--photo-ratio": photo.image.width / photo.image.height,
                } as CSSProperties
              }
              data-post-photo-trigger
              data-post-id={postId}
              aria-label={`View photograph ${index + 1} of ${photos.length}: ${photo.description}`}
              aria-haspopup="dialog"
              onClick={(event) => {
                returnTo.current = event.currentTarget;
                setSelected(index);
              }}
            >
              <Image
                {...photo.image}
                alt={photo.description}
                className="margin-post-image"
                sizes={
                  multiple
                    ? "(max-width: 639px) min(calc((100vw - 82px) * 0.65), 200px), 200px"
                    : `(max-width: 639px) min(calc(100vw - 82px), ${(480 * photo.image.width) / photo.image.height}px, ${(60 * photo.image.width) / photo.image.height}svh), min(550px, ${(480 * photo.image.width) / photo.image.height}px, ${(60 * photo.image.width) / photo.image.height}svh)`
                }
                loading="eager"
                fetchPriority={highPriority && index === 0 ? "high" : "auto"}
                unoptimized={photo.image.src.startsWith("blob:")}
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
      {selected !== null && (
        <PostPhotoViewer
          photos={photos}
          initialIndex={selected}
          postId={postId}
          authorName={authorName}
          onClose={() => setSelected(null)}
          onRestoreFocus={(event) => {
            event.preventDefault();
            returnTo.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}
