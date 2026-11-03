import Link from "next/link";
import Image from "next/image";
import { Gallery, ChevronRight } from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { ProfileSection } from "./profile-section";
import type { PostMedia } from "@/features/feed/schema";
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
        <Link
          href={href}
          className="margin-gallery-preview"
          data-count={Math.min(photos.length, 3)}
          aria-label={`View all ${photos.length} photographs`}
        >
          {photos.slice(0, 3).map((photo, index) => (
            <Image
              key={photo.image.src}
              {...photo.image}
              alt={photo.description}
              title={photo.description}
              loading="eager"
              unoptimized={live || photo.image.src.startsWith("blob:")}
              sizes={`(min-width: 1152px) ${photos.length === 1 ? 384 : photos.length === 2 ? 192 : index === 0 ? 256 : 128}px, (min-width: 640px) 180px, calc((100vw - 110px) / 3)`}
            />
          ))}
        </Link>
      )}
    </ProfileSection>
  );
}
