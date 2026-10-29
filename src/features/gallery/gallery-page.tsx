"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Aperture,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Grip,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { PhotoViewerFigure } from "@/components/shared/photo-viewer-figure";
import { FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import {
  GALLERY_LIMIT,
  photoLabel,
  previewMessage,
  type Photo,
} from "@/features/local-preview/model";
import { useGalleryDrag } from "./use-gallery-drag";
import { PhotoPicker } from "./photo-picker";
import { canReadFriendsPost } from "@/lib/friend-audience";

export function GalleryPage({ personId }: { personId?: string }) {
  const preview = usePreview();
  const ownerId = personId ?? preview.bootstrap.viewerId;
  const own = ownerId === preview.bootstrap.viewerId;
  const visible = canReadFriendsPost(
    preview.bootstrap.viewerId,
    ownerId,
    preview.state.friendships,
  );
  const profile = preview.state.profiles.find(
    (item) => item.person.id === ownerId,
  );
  const [arranging, setArranging] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState(false);
  const [viewing, setViewing] = useState(false);
  const arrangeButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLButtonElement | null>(null);
  function restoreFocus(event: Event) {
    event.preventDefault();
    const target = returnTo.current?.isConnected
      ? returnTo.current
      : arrangeButton.current;
    target?.focus({ preventScroll: true });
  }
  const entries = own
    ? preview.state.gallery
    : visible
      ? (profile?.photos.map((_, index) => ({
          photoId: `guest-${index}`,
          featured: index < 3,
        })) ?? [])
      : [];
  const photos = own
    ? entries.map((entry) =>
        preview.state.photos.find((photo) => photo.id === entry.photoId)!,
      )
    : visible
      ? (profile?.photos.map((photo, index): Photo => ({
          ...photo,
          id: `guest-${index}`,
          ownerId,
          title: photo.caption,
          kind: "fixture",
        })) ?? [])
      : [];
  const index = photos.findIndex((photo) => photo.id === selectedId);
  const selected = photos[index];
  const featured = entries[index]?.featured ?? false;
  const groups = [true, false].map((flag) =>
    photos.filter((_, position) => entries[position]?.featured === flag),
  );
  const ordered = groups.flat();
  const viewedIndex = ordered.findIndex((photo) => photo.id === selectedId);
  function moveViewedPhoto(step: number) {
    const next = ordered[viewedIndex + step];
    if (next) setSelectedId(next.id);
  }
  const selectedGroup = groups[featured ? 0 : 1];
  const groupIndex = selectedGroup.findIndex(
    (photo) => photo.id === selectedId,
  );
  function action(fn: () => void, message: string) {
    try {
      fn();
      setError("");
      setStatus(message);
    } catch (error) {
      setError(previewMessage(error));
    }
  }
  const {
    stage: stageRef,
    ghost: ghostRef,
    lift,
    cancel: cancelDrag,
    position,
    handle,
  } = useGalleryDrag(entries, (id, target) =>
    action(
      () => preview.movePhoto(id, target),
      `Moved ${photoLabel(photos.find((photo) => photo.id === id)!)} to photograph ${ordered.findIndex((photo) => photo.id === target) + 1} of ${photos.length}${entries.find((entry) => entry.photoId === target)?.featured ? ", featured" : ""}.`,
    ),
  );
  const lifted = photos.find((photo) => photo.id === lift?.id);
  const back = own
    ? "/?view=profile"
    : `/?view=profile&person=${encodeURIComponent(ownerId)}`;
  if (!profile || !visible)
    return (
      <section className="margin-gallery-page">
        <h1>Gallery unavailable</h1>
        <p className="margin-empty-copy">
          Photographs are shared with friends.
        </p>
        <Link href="/">Back to feed</Link>
      </section>
    );
  return (
    <section className="margin-gallery-page" aria-labelledby="gallery-title">
      <header className="margin-gallery-header" data-own={own}>
        <Link href={back} className="margin-back-link">
          <ChevronLeft aria-hidden="true" />
          Profile
        </Link>
        <SectionTitle
          as="h1"
          id="gallery-title"
          motif={<SectionMotif icon={Aperture} />}
        >
          {own ? "Your Gallery" : `${profile.person.name}’s gallery`}
        </SectionTitle>
        {own && (
          <Button
            className="margin-gallery-add-desktop"
            variant="outline"
            onClick={() => setPicking(true)}
          >
            <Plus aria-hidden="true" />
            Add photo
          </Button>
        )}
      </header>
      {own && (
        <div className="margin-gallery-toolbar">
          <Button
            ref={arrangeButton}
            className="margin-gallery-arrange"
            variant="ghost"
            aria-pressed={arranging}
            onClick={() => {
              cancelDrag();
              setArranging(!arranging);
              setSelectedId(null);
              setPending(null);
            }}
          >
            <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} />
            {arranging ? "Done arranging" : "Arrange gallery"}
          </Button>
          <Button
            className="margin-gallery-add-mobile"
            variant="secondary"
            onClick={() => setPicking(true)}
          >
            <Plus aria-hidden="true" />
            Add photo
          </Button>
        </div>
      )}
      {arranging && (
        <p
          className="margin-field-hint margin-gallery-help"
          id="gallery-arrange-help"
        >
          Drag a handle, use its arrow keys, or select a photograph for move
          controls. Release in the open space to place it; Escape cancels.
          Moving between rows exchanges featured positions. Changes reset on
          refresh.
        </p>
      )}
      {pending && (
        <div className="margin-gallery-notice">
          <Image
            {...pending.image}
            unoptimized={pending.kind === "local"}
            alt={pending.description}
            width={80}
            height={80}
            loading="eager"
          />
          <div>
            <strong>Adding one photograph</strong>
            <p>
              Your gallery is full. Choose one to replace; the new photograph
              takes its place.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setSelectedId(null);
              }}
            >
              Cancel replacement
            </Button>
          </div>
        </div>
      )}
      <div className="margin-gallery-meta">
        <span>
          {photos.length} of {GALLERY_LIMIT}
        </span>
      </div>
      {!photos.length && (
        <p className="margin-empty-copy">
          {own
            ? "Keep a photograph here to begin your gallery."
            : "No photographs here yet."}
        </p>
      )}
      <div
        ref={stageRef}
        className="margin-gallery-stage"
        data-dragging={!!lift}
      >
        {groups.map(
          (group, groupIndex) =>
            group.length > 0 && (
              <section
                key={groupIndex}
                className="margin-gallery-group"
                aria-label={
                  groupIndex === 0 ? "Featured photographs" : "More photographs"
                }
              >
                <div
                  className={
                    groupIndex === 0
                      ? "margin-gallery-featured"
                      : "margin-gallery-grid"
                  }
                >
                  {group.map((photo) => (
                    <div
                      key={photo.id}
                      className="margin-gallery-cell"
                      data-gallery-photo={photo.id}
                      data-lifted={lift?.id === photo.id}
                      style={position(photo.id)}
                    >
                      <button
                        type="button"
                        className="margin-gallery-tile"
                        aria-pressed={
                          arranging || pending
                            ? photo.id === selectedId
                            : undefined
                        }
                        aria-label={`${pending ? "Replace" : arranging ? "Select" : "View"} ${photoLabel(photo)}, photograph ${ordered.indexOf(photo) + 1} of ${photos.length}`}
                        onClick={(event) => {
                          returnTo.current = event.currentTarget;
                          setSelectedId(photo.id);
                          setError("");
                          if (!arranging && !pending) setViewing(true);
                        }}
                      >
                        <Image
                          {...photo.image}
                          alt={photo.description}
                          unoptimized={photo.kind === "local"}
                          loading="eager"
                          sizes="(max-width: 640px) 50vw, 400px"
                        />
                        {(arranging || pending) && photo.id === selectedId && (
                          <span className="margin-photo-selected">
                            <Check aria-hidden="true" />
                          </span>
                        )}
                      </button>
                      {lift?.id === photo.id && (
                        <span
                          className="margin-gallery-placeholder"
                          aria-hidden="true"
                        >
                          Place here
                        </span>
                      )}
                      {own && arranging && !pending && (
                        <button
                          type="button"
                          className="margin-gallery-drag"
                          aria-label={`Move ${photoLabel(photo)}`}
                          aria-describedby="gallery-arrange-help"
                          {...handle(photo.id)}
                        >
                          <Grip aria-hidden="true" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ),
        )}
      </div>
      {lifted &&
        lift &&
        createPortal(
          <div
            ref={ghostRef}
            className="margin-gallery-floating"
            aria-hidden="true"
            style={{ width: lift.width, height: lift.height }}
          >
            <Image
              {...lifted.image}
              alt=""
              unoptimized={lifted.kind === "local"}
              loading="eager"
              sizes="160px"
              draggable={false}
            />
          </div>,
          document.body,
        )}
      {error && <FieldError>{error}</FieldError>}
      <p role="status" className={arranging ? "sr-only" : "margin-status"}>
        {lifted && lift?.target
          ? `${photoLabel(lifted)}, destination ${ordered.findIndex((photo) => photo.id === lift!.target) + 1} of ${photos.length}${entries.find((entry) => entry.photoId === lift!.target)?.featured ? ", featured" : ""}. Release to place.`
          : status}
      </p>
      {own && selected && (arranging || pending) && (
        <footer className="margin-gallery-controls">
          <strong className={arranging && !pending ? "sr-only" : undefined}>
            {photoLabel(selected)}
          </strong>
          {pending ? (
            <>
              <p>
                Replacing this photograph removes it from the gallery only. It
                remains in any posts.
              </p>
              <Button
                onClick={() =>
                  action(() => {
                    preview.place(pending.id, selected.id);
                    setSelectedId(pending.id);
                    setPending(null);
                  }, "Photograph replaced in your local gallery.")
                }
              >
                Replace photograph in gallery
              </Button>
            </>
          ) : (
            <>
              <div className="margin-gallery-actions">
                <Button
                  variant="ghost"
                  disabled={groupIndex === 0}
                  onClick={() =>
                    action(
                      () => preview.changeGallery(selected.id, "earlier"),
                      "Photograph moved earlier.",
                    )
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                  Move earlier
                </Button>
                <Button
                  variant="ghost"
                  disabled={groupIndex === selectedGroup.length - 1}
                  onClick={() =>
                    action(
                      () => preview.changeGallery(selected.id, "later"),
                      "Photograph moved later.",
                    )
                  }
                >
                  Move later
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  aria-pressed={featured}
                  onClick={() =>
                    action(
                      () => preview.changeGallery(selected.id, "feature"),
                      featured
                        ? "Photograph no longer featured."
                        : "Photograph featured.",
                    )
                  }
                >
                  {featured ? "Unfeature" : "Feature photograph"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={(event) => {
                    returnTo.current = event.currentTarget;
                    setViewing(true);
                  }}
                >
                  View full image
                </Button>
                <Button
                  variant="ghost"
                  onClick={(event) => {
                    returnTo.current = event.currentTarget;
                    setRemoving(true);
                  }}
                >
                  Remove from gallery
                </Button>
              </div>
              <p className="margin-field-hint">
                Up to three photographs can be featured. Removing one from your
                gallery keeps it in its posts.
              </p>
            </>
          )}
        </footer>
      )}
      <PhotoPicker
        context="gallery"
        open={picking}
        onOpenChange={setPicking}
        onChoose={(photo) => {
          setPicking(false);
          if (
            entries.length >= GALLERY_LIMIT &&
            !entries.some((entry) => entry.photoId === photo.id)
          ) {
            setPending(photo);
            setSelectedId(null);
          } else
            action(() => {
              preview.place(photo.id);
              setSelectedId(photo.id);
              setArranging(true);
            }, "Photograph added to your local gallery.");
        }}
      />
      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>Remove from gallery?</DialogTitle>
            <DialogDescription>
              The photograph stays in any posts. This changes your local gallery
              only.
            </DialogDescription>
          </DialogHeader>
          <div className="margin-form-actions">
            <Button variant="ghost" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                action(() => {
                  if (selected) preview.changeGallery(selected.id, "remove");
                  setRemoving(false);
                  setSelectedId(null);
                }, "Photograph removed from the gallery; its posts are unchanged.")
              }
            >
              Remove from gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={viewing && !!selected} onOpenChange={setViewing}>
        <DialogContent
          className="margin-photo-viewer"
          onCloseAutoFocus={restoreFocus}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              moveViewedPhoto(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <DialogTitle>Photograph</DialogTitle>
          {selected && <PhotoViewerFigure photo={selected} sizes="960px" />}
          {ordered.length > 1 && (
            <div className="margin-photo-viewer-navigation">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous photograph"
                disabled={viewedIndex <= 0}
                onClick={() => moveViewedPhoto(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="margin-note" aria-live="polite">
                {viewedIndex + 1} of {ordered.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next photograph"
                disabled={viewedIndex === ordered.length - 1}
                onClick={() => moveViewedPhoto(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
          {own && (
            <Button
              variant="ghost"
              className="margin-photo-arrange"
              onClick={() => {
                setViewing(false);
                setArranging(true);
              }}
            >
              Arrange photograph
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
