"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gallery, ChevronRight } from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { ProfileSection } from "./profile-section";
import type { PostMedia } from "@/features/feed/schema";
import { PostPhotoViewer } from "@/features/feed/post-photo-viewer";
export function ProfileGalleryPreview({
  photos,
  href,
  visible,
  own,
  live = false,
}: {
  photos: PostMedia[];
  href: string;
  visible: boolean;
  own: boolean;
  live?: boolean;
}) {
  const [viewed, setViewed] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <ProfileSection
      className="margin-profile-gallery"
      aria-labelledby="profile-gallery-title"
    >
      <header className="margin-section-heading">
        <SectionTitle
          id="profile-gallery-title"
          motif={<SectionMotif icon={Gallery} />}
        >
          Gallery
        </SectionTitle>
        {visible && (
          <Link href={href} className="margin-section-link">
            View More
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </header>
      {!visible ? (
        <p className="margin-empty-copy">Photos are shared with friends.</p>
      ) : !photos.length ? (
        <p className="margin-empty-copy">
          {own
            ? "Your photographs will appear here."
            : "No photographs here yet."}
        </p>
      ) : (
        <div
          className="margin-gallery-preview margin-gallery-mosaic"
          data-count={Math.min(photos.length, 3)}
        >
          {photos.slice(0, 3).map((photo, index) => (
            <button
              type="button"
              key={`${photo.image.src}-${index}`}
              data-photo-open
              aria-label={`View photograph ${index + 1} of ${Math.min(photos.length, 3)}`}
              aria-haspopup="dialog"
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setViewed(index);
              }}
            >
              <Image
                {...photo.image}
                alt={photo.description}
                title={photo.description}
                loading="eager"
                unoptimized={live || photo.image.src.startsWith("blob:")}
                sizes={`(min-width: 1152px) ${photos.length === 1 ? 384 : photos.length === 2 ? 192 : index === 0 ? 256 : 128}px, calc((100vw - 110px) / ${photos.length === 1 ? 1 : photos.length === 2 ? 2 : index === 0 ? 1.5 : 3})`}
              />
            </button>
          ))}
        </div>
      )}
      {viewed !== null && (
        <PostPhotoViewer
          photos={photos.slice(0, 3)}
          initialIndex={viewed}
          postId="profile-gallery"
          authorName="Gallery"
          context="gallery"
          privateMedia={live}
          onClose={() => setViewed(null)}
          onRestoreFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </ProfileSection>
  );
}
