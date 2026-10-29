"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import {
  Aperture,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { PersonLink } from "@/components/shared/person-link";
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
import { PhotoPicker } from "./photo-picker";
import { GalleryEditor } from "./gallery-editor";
import { canReadFriendsPost } from "@/lib/friend-audience";

type Editor = { addition?: Photo; selectedId?: string };
export function GalleryPage({ personId }: { personId?: string }) {
  const preview = usePreview();
  const ownerId = personId ?? preview.bootstrap.viewerId;
  const own = ownerId === preview.bootstrap.viewerId;
  const profile = preview.state.profiles.find(
    (item) => item.person.id === ownerId,
  );
  const visible = canReadFriendsPost(
    preview.bootstrap.viewerId,
    ownerId,
    preview.state.friendships,
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const deleted = useRef(false);
  const nextFocusId = useRef<string | null | undefined>(undefined);
  const arrangeAfterViewer = useRef<string | null>(null);
  const additionAfterPicker = useRef<Photo | null>(null);
  const entries = own
    ? preview.state.gallery
    : visible
      ? (profile?.photos.map((_, index) => ({
          photoId: `guest-${index}`,
          featured: index < 3,
        })) ?? [])
      : [];
  const photos = own
    ? entries.flatMap((entry) => {
        const item = preview.state.photos.find(
          (photo) => photo.id === entry.photoId,
        );
        return item ? [item] : [];
      })
    : visible
      ? (profile?.photos.map((photo, index): Photo => ({
          ...photo,
          id: `guest-${index}`,
          ownerId,
          title: photo.caption,
          kind: "fixture",
        })) ?? [])
      : [];
  const groups = [true, false].map((flag) =>
    photos.filter(
      (photo) =>
        entries.find((entry) => entry.photoId === photo.id)?.featured === flag,
    ),
  );
  const ordered = groups.flat();
  const viewedIndex = ordered.findIndex((photo) => photo.id === selectedId);
  const selected = ordered[viewedIndex];
  function restoreFocus(event: Event) {
    event.preventDefault();
    if (arrangeAfterViewer.current) {
      const id = arrangeAfterViewer.current;
      arrangeAfterViewer.current = null;
      setEditor({ selectedId: id });
      return;
    }
    if (nextFocusId.current !== undefined) {
      const cell = Array.from(
        stage.current?.querySelectorAll<HTMLElement>("[data-gallery-item]") ??
          [],
      ).find((item) => item.dataset.galleryItem === nextFocusId.current);
      returnTo.current =
        cell?.querySelector<HTMLButtonElement>(".margin-gallery-tile") ??
        heading.current;
      nextFocusId.current = undefined;
    }
    const target =
      returnTo.current?.isConnected && !returnTo.current.matches(":disabled")
        ? returnTo.current
        : heading.current;
    target?.focus({ preventScroll: true });
  }
  function moveViewedPhoto(step: number) {
    const next = ordered[viewedIndex + step];
    if (next) setSelectedId(next.id);
  }
  if (!profile || !visible)
    return (
      <section className="margin-gallery-page">
        <h1>Gallery Unavailable</h1>
        <p className="margin-empty-copy">
          Photographs are shared with friends.
        </p>
        <Link href="/">Back to feed</Link>
      </section>
    );
  const back = own
    ? "/?view=profile"
    : `/?view=profile&person=${encodeURIComponent(ownerId)}`;
  return (
    <section className="margin-gallery-page" aria-labelledby="gallery-title">
      <header className="margin-gallery-header" data-own={own}>
        <Link href={back} className="margin-back-link">
          <ChevronLeft aria-hidden="true" />
          Profile
        </Link>
        <div className="margin-gallery-introduction">
          <SectionTitle
            as="h1"
            id="gallery-title"
            ref={heading}
            tabIndex={-1}
            motif={<SectionMotif icon={Aperture} />}
          >
            {own ? (
              "Your Gallery"
            ) : (
              <>
                <PersonLink person={profile.person}>
                  {profile.person.name}
                </PersonLink>
                ’s Gallery
              </>
            )}
          </SectionTitle>
          <p>
            {own
              ? "A collection of your photographs, with up to three featured."
              : "Photographs shared with friends."}
          </p>
        </div>
        <div className="margin-gallery-toolbar">
          <p className="margin-gallery-meta">
            {photos.length} of {GALLERY_LIMIT} photographs
          </p>
          {own && (
            <div className="margin-gallery-page-actions">
              <Button
                className="margin-gallery-arrange"
                variant="outline"
                aria-label="Arrange gallery"
                aria-haspopup="dialog"
                disabled={!photos.length}
                onClick={(event) => {
                  returnTo.current = event.currentTarget;
                  setError("");
                  setEditor({});
                }}
              >
                <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} />
                Arrange
              </Button>
              <Button
                className="margin-gallery-add"
                onClick={(event) => {
                  returnTo.current = event.currentTarget;
                  setPicking(true);
                }}
              >
                <Plus aria-hidden="true" />
                Add photo
              </Button>
            </div>
          )}
        </div>
      </header>
      {!photos.length && (
        <p className="margin-empty-copy">
          {own
            ? "Keep a photograph here to begin your gallery."
            : "No photographs here yet."}
        </p>
      )}
      <div ref={stage} className="margin-gallery-stage">
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
                      key={photo.id}
                      className="margin-gallery-cell"
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
                        aria-label={`View ${photoLabel(photo)}, photograph ${ordered.indexOf(photo) + 1} of ${photos.length}`}
                        onClick={(event) => {
                          returnTo.current = event.currentTarget;
                          nextFocusId.current = undefined;
                          setSelectedId(photo.id);
                          setError("");
                          setViewing(true);
                        }}
                      >
                        <Image
                          {...photo.image}
                          alt={photo.description}
                          unoptimized={photo.kind === "local"}
                          loading={
                            ordered.indexOf(photo) < 3 ? "eager" : "lazy"
                          }
                          sizes={
                            groupIndex === 0
                              ? group.length !== 2 && group[0] === photo
                                ? "(max-width: 639px) 90vw, (max-width: 1008px) 32vw, 320px"
                                : "(max-width: 639px) 45vw, (max-width: 1008px) 32vw, 320px"
                              : "(max-width: 639px) 28vw, (max-width: 1023px) 22vw, 185px"
                          }
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ),
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <p role="status" className="margin-status">
        {status}
      </p>
      <PhotoPicker
        context="gallery"
        open={picking}
        onOpenChange={setPicking}
        onChoose={(photo) => {
          additionAfterPicker.current = photo;
          setPicking(false);
        }}
        onCloseAutoFocus={(event) => {
          if (additionAfterPicker.current) {
            event.preventDefault();
            const addition = additionAfterPicker.current;
            additionAfterPicker.current = null;
            setEditor({ addition });
          } else restoreFocus(event);
        }}
      />
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        {editor && (
          <GalleryEditor
            addition={editor.addition}
            initialSelection={editor.selectedId}
            onCancel={() => setEditor(null)}
            onDone={() => {
              setEditor(null);
              setStatus("");
            }}
            onRestoreFocus={restoreFocus}
          />
        )}
      </Dialog>
      <Dialog open={viewing && !!selected} onOpenChange={setViewing}>
        <DialogContent
          className="margin-photo-viewer"
          onCloseAutoFocus={restoreFocus}
          onKeyDown={(event) => {
            if (!deleting && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
              event.preventDefault();
              moveViewedPhoto(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <DialogTitle>Photograph</DialogTitle>
          {selected && <PhotoViewerFigure photo={selected} sizes="960px" />}
          <footer className="margin-gallery-viewer-footer">
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
            {own && (
              <div className="margin-photo-viewer-actions">
                <Button
                  variant="outline"
                  className="margin-photo-arrange"
                  aria-label="Arrange photograph"
                  onClick={() => {
                    arrangeAfterViewer.current = selected.id;
                    setViewing(false);
                  }}
                >
                  <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} />
                  Arrange
                </Button>
                <Button
                  variant="ghost"
                  className="margin-gallery-delete"
                  aria-label="Delete photograph"
                  onClick={(event) => {
                    deleteTrigger.current = event.currentTarget;
                    deleted.current = false;
                    setDeleting(true);
                  }}
                >
                  <Trash2 aria-hidden="true" strokeWidth={1.5} />
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setViewing(false)}>
                  Done
                </Button>
              </div>
            )}
          </footer>
        </DialogContent>
      </Dialog>
      <Dialog open={deleting && !!selected && own} onOpenChange={setDeleting}>
        <DialogContent
          role="alertdialog"
          onCloseAutoFocus={(event) => {
            if (deleted.current) restoreFocus(event);
            else {
              event.preventDefault();
              if (deleteTrigger.current?.isConnected)
                deleteTrigger.current.focus({ preventScroll: true });
              else restoreFocus(event);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete Photograph?</DialogTitle>
            <DialogDescription>
              This removes the photograph from your gallery, photo library, and
              any of your posts or drafts. Post text and conversations stay.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="margin-gallery-delete-preview">
              <Image
                {...selected.image}
                alt={selected.description}
                unoptimized={selected.kind === "local"}
                width={80}
                height={80}
                sizes="80px"
              />
              <p>{photoLabel(selected)}</p>
            </div>
          )}
          <p className="margin-field-hint">
            Local preview only. Changes stay in this tab; sample photographs
            return on refresh.
          </p>
          {error && <FieldError>{error}</FieldError>}
          <div className="margin-form-actions">
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  if (!selected) return;
                  const next =
                    ordered[viewedIndex + 1] ?? ordered[viewedIndex - 1];
                  preview.deletePhoto(selected.id);
                  deleted.current = true;
                  nextFocusId.current = next?.id ?? null;
                  setDeleting(false);
                  setViewing(false);
                  setSelectedId(null);
                  setError("");
                  setStatus(
                    "Photograph deleted from your gallery, photo library, and posts.",
                  );
                } catch (error) {
                  setError(previewMessage(error));
                }
              }}
            >
              Delete photograph
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
