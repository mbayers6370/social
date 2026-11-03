"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Add, ChevronLeft, Filter, Gallery } from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { GalleryEditor } from "@/features/gallery/gallery-editor";
import { PostPhotoViewer } from "@/features/feed/post-photo-viewer";
import type { Photo } from "@/features/local-preview/model";
import { useSpaceClient } from "@/features/spaces/client";
import { MemberPhotoPicker } from "./member-photo-picker";
import { requestMember, memberJson, memberChanged } from "./member-client";
import type { PrivateProfileData } from "./contracts";

export function MemberGallery({ data }: { data: PrivateProfileData }) {
  const client = useSpaceClient();
  const router = useRouter();
  const own = data.profile.relationship === "self";
  const visible = own || data.profile.relationship === "friends";
  const [arranging, setArranging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viewed, setViewed] = useState<number | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const entries = data.gallery.map((photo) => ({
    photoId: photo.id,
    featured: photo.featured ?? false,
  }));
  const photos: Photo[] = data.gallery.map((photo) => ({
    id: photo.id,
    ownerId: data.profile.id,
    kind: "local",
    title: photo.description,
    description: photo.description,
    caption: "",
    aspect: photo.width >= photo.height ? "landscape" : "portrait",
    image: {
      src: client.photoSrc(photo.id),
      width: photo.width,
      height: photo.height,
    },
  }));
  const groups = [true, false].map((flag) =>
    photos.filter(
      (photo) =>
        entries.find((entry) => entry.photoId === photo.id)?.featured === flag,
    ),
  );
  const ordered = groups.flat();
  const restore = (event: Event) => {
    event.preventDefault();
    const target = trigger.current?.isConnected
      ? trigger.current
      : heading.current;
    target?.focus({ preventScroll: true });
  };
  return (
    <LiveAppShell active="profile" viewer={data.viewer}>
      <section className="margin-gallery-page" aria-labelledby="gallery-title">
        <header className="margin-gallery-header" data-own={own}>
          <Link
            className="margin-back-link"
            href={
              own
                ? "/app"
                : `/app?person=${encodeURIComponent(data.profile.id)}`
            }
          >
            <ChevronLeft aria-hidden="true" />
            Profile
          </Link>
          <div className="margin-gallery-introduction">
            <SectionTitle
              as="h1"
              id="gallery-title"
              ref={heading}
              tabIndex={-1}
              motif={<SectionMotif icon={Gallery} />}
            >
              {own ? "Your Gallery" : `${data.profile.name}’s Gallery`}
            </SectionTitle>
            <p>
              {own
                ? "A collection of your photographs, with up to three featured."
                : "Photographs shared with friends."}
            </p>
          </div>
          {visible && (
            <div className="margin-gallery-toolbar">
              <p className="margin-gallery-meta">
                {photos.length} of 20 photographs
              </p>
              {own && (
                <div className="margin-gallery-page-actions">
                  <Button
                    variant="outline"
                    className="margin-gallery-arrange"
                    aria-label="Arrange gallery"
                    aria-haspopup="dialog"
                    disabled={!photos.length}
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setArranging(true);
                    }}
                  >
                    <Filter aria-hidden="true" />
                    Arrange
                  </Button>
                  <Button
                    className="margin-gallery-add"
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setAdding(true);
                    }}
                  >
                    <Add aria-hidden="true" />
                    Add photo
                  </Button>
                </div>
              )}
            </div>
          )}
        </header>
        {!visible ? (
          <p className="margin-empty-copy">
            Photographs are shared with friends.
          </p>
        ) : !photos.length ? (
          <p className="margin-empty-copy">
            {own
              ? "Keep a photograph here to begin your gallery."
              : "No photographs here yet."}
          </p>
        ) : (
          <div className="margin-gallery-stage">
            {groups.map(
              (group, groupIndex) =>
                !!group.length && (
                  <section
                    className="margin-gallery-group"
                    key={groupIndex}
                    aria-label={
                      groupIndex === 0
                        ? "Featured photographs"
                        : "More photographs"
                    }
                  >
                    <header className="margin-gallery-group-heading">
                      <h2>
                        {groupIndex === 0
                          ? "Featured Photographs"
                          : groups[0].length
                            ? "More Photographs"
                            : "Photographs"}
                      </h2>
                      {groupIndex === 0 && <p>Shown first on the profile</p>}
                    </header>
                    <div
                      className={
                        groupIndex === 0
                          ? "margin-gallery-featured"
                          : "margin-gallery-grid"
                      }
                    >
                      {group.map((photo) => (
                        <div
                          className="margin-gallery-cell"
                          key={photo.id}
                          data-gallery-item={photo.id}
                          style={
                            {
                              "--gallery-photo-ratio":
                                photo.image.width / photo.image.height,
                            } as CSSProperties
                          }
                        >
                          <button
                            type="button"
                            className="margin-gallery-tile"
                            aria-label={`View ${photo.description}, photograph ${ordered.indexOf(photo) + 1} of ${photos.length}`}
                            onClick={(event) => {
                              trigger.current = event.currentTarget;
                              setViewed(ordered.indexOf(photo));
                            }}
                          >
                            <Image
                              unoptimized
                              {...photo.image}
                              alt={photo.description}
                              title={photo.description}
                              sizes="(max-width: 639px) 45vw, 320px"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ),
            )}
          </div>
        )}
      </section>
      {viewed !== null && (
        <PostPhotoViewer
          privateMedia
          photos={ordered}
          initialIndex={viewed}
          postId={`gallery-${data.profile.id}`}
          authorName={data.profile.name}
          onClose={() => setViewed(null)}
          onRestoreFocus={restore}
        />
      )}
      {own && (
        <>
          <MemberPhotoPicker
            open={adding}
            onOpenChange={setAdding}
            photos={data.gallery}
            onChoose={() => {
              memberChanged();
              router.refresh();
            }}
          />
          <Dialog open={arranging} onOpenChange={setArranging}>
            {arranging && (
              <GalleryEditor
                source={{
                  gallery: entries,
                  photos,
                  save: async (input) => {
                    await requestMember(
                      client,
                      "/api/gallery",
                      memberJson("PUT", {
                        version: data.profile.galleryVersion ?? 0,
                        entries: input.entries,
                        deletedPhotoIds: input.deletedPhotoIds,
                      }),
                    );
                    memberChanged();
                    router.refresh();
                  },
                }}
                onDone={() => setArranging(false)}
                onCancel={() => setArranging(false)}
                onRestoreFocus={restore}
              />
            )}
          </Dialog>
        </>
      )}
    </LiveAppShell>
  );
}
