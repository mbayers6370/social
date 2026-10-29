"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Grip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
  Dialog,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { usePreview } from "@/features/local-preview/provider";
import {
  FEATURED_LIMIT,
  GALLERY_LIMIT,
  moveGalleryEntries,
  photoLabel,
  previewMessage,
  type GalleryEntry,
  type Photo,
} from "@/features/local-preview/model";
import { useGalleryDrag } from "./use-gallery-drag";

export function GalleryEditor({
  addition,
  initialSelection,
  onCancel,
  onDone,
  onRestoreFocus,
}: {
  addition?: Photo;
  initialSelection?: string;
  onCancel: () => void;
  onDone: () => void;
  onRestoreFocus: (event: Event) => void;
}) {
  const preview = usePreview();
  const [base] = useState(() =>
    preview.state.gallery.map((entry) => ({ ...entry })),
  );
  const [entries, setEntries] = useState<GalleryEntry[]>(() =>
    addition &&
    base.length < GALLERY_LIMIT &&
    !base.some((entry) => entry.photoId === addition.id)
      ? [...base, { photoId: addition.id, featured: false }]
      : base,
  );
  const [selectedId, setSelectedId] = useState(
    initialSelection ??
      (addition && entries.some((entry) => entry.photoId === addition.id)
        ? addition.id
        : null),
  );
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [replacement, setReplacement] = useState<{
    oldPhotoId: string;
    newPhotoId: string;
  }>();
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const featureButton = useRef<HTMLButtonElement>(null);
  const photo = (id: string) =>
    preview.state.photos.find((item) => item.id === id)!;
  const groups = [true, false].map((flag) =>
    entries.filter((entry) => entry.featured === flag),
  );
  const ordered = groups.flat();
  const selectedEntry = entries.find((entry) => entry.photoId === selectedId);
  const selected = selectedEntry ? photo(selectedEntry.photoId) : undefined;
  const selectedGroup = groups[selectedEntry?.featured ? 0 : 1];
  const groupIndex = selectedGroup.findIndex(
    (entry) => entry.photoId === selectedId,
  );
  const needsReplacement =
    !!addition && !entries.some((entry) => entry.photoId === addition.id);
  function change(next: GalleryEntry[], message: string) {
    setEntries(next);
    setError("");
    setStatus(message);
  }
  function feature(id: string) {
    const entry = entries.find((entry) => entry.photoId === id);
    if (!entry) return;
    if (!entry.featured && groups[0].length >= FEATURED_LIMIT) {
      setError(
        "You can feature up to three photographs. Move one out or exchange it with another photograph.",
      );
      return;
    }
    change(
      entries.map((entry) =>
        entry.photoId === id ? { ...entry, featured: !entry.featured } : entry,
      ),
      entry.featured
        ? "Photograph no longer featured."
        : "Photograph featured.",
    );
  }
  const {
    stage,
    ghost,
    lift,
    cancel: cancelDrag,
    isActive,
    position,
    handle,
  } = useGalleryDrag(
    entries,
    (id, target) => {
      setSelectedId(id);
      change(
        moveGalleryEntries(entries, id, target),
        `Moved ${photoLabel(photo(id))} to photograph ${ordered.findIndex((entry) => entry.photoId === target) + 1} of ${entries.length}${entries.find((entry) => entry.photoId === target)?.featured ? ", featured" : ""}.`,
      );
    },
    scroller,
    (id) => {
      setSelectedId(id);
      if (!entries.find((entry) => entry.photoId === id)?.featured) feature(id);
    },
  );
  const lifted = lift ? photo(lift.id) : undefined;
  function move(step: number) {
    const target = selectedGroup[groupIndex + step];
    if (selected && target) {
      cancelDrag();
      change(
        moveGalleryEntries(entries, selected.id, target.photoId),
        "Photograph moved.",
      );
    }
  }
  return (
    <DialogContent
      className="margin-gallery-editor"
      aria-describedby="gallery-arrange-help"
      onCloseAutoFocus={onRestoreFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        title.current?.focus();
      }}
      onEscapeKeyDown={(event) => {
        if (isActive() || deleting) {
          event.preventDefault();
          cancelDrag();
        }
      }}
    >
      <header className="margin-gallery-editor-header">
        <DialogTitle ref={title} tabIndex={-1}>
          {addition ? "Add Photograph" : "Arrange Gallery"}
        </DialogTitle>
        <DialogDescription id="gallery-arrange-help">
          Drag a handle or select a photograph and use the move controls. Arrow
          keys move a focused handle. Done saves your changes; Cancel leaves
          your gallery as it was.
        </DialogDescription>
      </header>
      <div ref={scroller} className="margin-gallery-editor-scroll">
        {needsReplacement && addition && (
          <div className="margin-gallery-replacement">
            <Image
              {...addition.image}
              alt={addition.description}
              sizes="64px"
              width={64}
              height={64}
              unoptimized={addition.kind === "local"}
            />
            <p>
              Your gallery is full. Select a photograph to replace with{" "}
              {photoLabel(addition)}. The replaced photograph stays in its posts
              and photo library.
            </p>
          </div>
        )}
        <div
          ref={stage}
          className="margin-gallery-stage"
          data-dragging={!!lift}
        >
          {groups.map((group, groupIndex) => (
            <section
              key={groupIndex}
              className="margin-editor-group"
              aria-label={
                groupIndex === 0 ? "Featured photographs" : "More photographs"
              }
            >
              <div className="margin-editor-group-heading">
                <h3>{groupIndex === 0 ? "Featured" : "More Photographs"}</h3>
                <span className="margin-note">
                  {group.length} of{" "}
                  {groupIndex === 0
                    ? FEATURED_LIMIT
                    : GALLERY_LIMIT - groups[0].length}
                </span>
              </div>
              <div
                className={
                  groupIndex === 0
                    ? "margin-editor-featured"
                    : "margin-editor-grid"
                }
              >
                {group.map((entry) => {
                  const item = photo(entry.photoId);
                  return (
                    <div
                      key={item.id}
                      className="margin-gallery-cell"
                      data-gallery-photo={item.id}
                      data-lifted={lift?.id === item.id}
                      style={position(item.id)}
                    >
                      <button
                        type="button"
                        className="margin-gallery-tile"
                        aria-pressed={selectedId === item.id}
                        aria-label={`Select ${photoLabel(item)}, photograph ${ordered.findIndex((entry) => entry.photoId === item.id) + 1} of ${entries.length}`}
                        onClick={() => {
                          setSelectedId(item.id);
                          setError("");
                        }}
                      >
                        <Image
                          {...item.image}
                          alt={item.description}
                          unoptimized={item.kind === "local"}
                          sizes="(max-width: 639px) 22vw, 112px"
                          loading="eager"
                          draggable={false}
                        />
                        {selectedId === item.id && (
                          <span className="margin-photo-selected">
                            <Check aria-hidden="true" />
                          </span>
                        )}
                      </button>
                      {lift?.id === item.id && (
                        <span
                          className="margin-gallery-placeholder"
                          aria-hidden="true"
                        >
                          Place here
                        </span>
                      )}
                      <button
                        type="button"
                        className="margin-gallery-drag"
                        aria-label={`Move ${photoLabel(item)}`}
                        aria-describedby="gallery-arrange-help"
                        {...handle(item.id)}
                      >
                        <Grip aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
                {groupIndex === 0 &&
                  Array.from(
                    { length: FEATURED_LIMIT - group.length },
                    (_, index) => (
                      <button
                        key={`empty-${index}`}
                        type="button"
                        className="margin-editor-empty-slot"
                        aria-label="Feature selected photograph"
                        data-gallery-empty-feature
                        data-drop-target={
                          (lift?.feature && index === 0) || undefined
                        }
                        disabled={
                          !selected ||
                          selectedEntry?.featured ||
                          needsReplacement
                        }
                        onClick={() => {
                          if (selected) {
                            cancelDrag();
                            feature(selected.id);
                          }
                        }}
                      >
                        <span aria-hidden="true">
                          {group.length + index + 1}
                        </span>
                        <span className="sr-only">Empty featured slot</span>
                      </button>
                    ),
                  )}
              </div>
              {groupIndex === 1 && !group.length && (
                <p className="margin-field-hint">
                  Your other photographs will appear here.
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
      {lifted &&
        lift &&
        createPortal(
          <div
            ref={ghost}
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
      <footer className="margin-gallery-editor-footer">
        {selected && (
          <div className="margin-editor-selection">
            <p title={photoLabel(selected)}>{photoLabel(selected)}</p>
            {needsReplacement && addition ? (
              <Button
                onClick={() => {
                  cancelDrag();
                  setReplacement({
                    oldPhotoId: selected.id,
                    newPhotoId: addition.id,
                  });
                  change(
                    entries.map((entry) =>
                      entry.photoId === selected.id
                        ? { ...entry, photoId: addition.id }
                        : entry,
                    ),
                    "Photograph ready to replace. Choose Done to save.",
                  );
                  setSelectedId(addition.id);
                }}
              >
                Replace selected photograph
              </Button>
            ) : (
              <div className="margin-editor-selection-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move earlier"
                  disabled={groupIndex <= 0}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move later"
                  disabled={groupIndex >= selectedGroup.length - 1}
                  onClick={() => move(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  ref={featureButton}
                  variant="outline"
                  disabled={
                    !selectedEntry?.featured &&
                    groups[0].length >= FEATURED_LIMIT
                  }
                  aria-pressed={selectedEntry?.featured}
                  onClick={() => {
                    cancelDrag();
                    feature(selected.id);
                  }}
                >
                  {selectedEntry?.featured ? "Unfeature" : "Feature photograph"}
                </Button>
                {base.some((entry) => entry.photoId === selected.id) && (
                  <Button
                    ref={deleteTrigger}
                    variant="ghost"
                    size="icon"
                    className="margin-gallery-delete"
                    aria-label="Delete photograph"
                    onClick={() => setDeleting(selected)}
                  >
                    <Trash2 aria-hidden="true" strokeWidth={1.5} />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {error && <FieldError>{error}</FieldError>}
        {deletedPhotoIds.length > 0 && (
          <p className="margin-field-hint">
            {deletedPhotoIds.length}{" "}
            {deletedPhotoIds.length === 1
              ? "photograph will"
              : "photographs will"}{" "}
            be deleted when you choose Done.
          </p>
        )}
        <p role="status" className="sr-only">
          {lifted && lift?.feature
            ? `Feature ${photoLabel(lifted)} on the profile. Release to place.`
            : lifted && lift?.target
              ? `${photoLabel(lifted)}, destination ${ordered.findIndex((entry) => entry.photoId === lift.target) + 1} of ${entries.length}${entries.find((entry) => entry.photoId === lift.target)?.featured ? ", featured" : ""}. Release to place.`
              : status}
        </p>
        <div className="margin-gallery-editor-complete">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={needsReplacement || !!lift}
            onClick={() => {
              try {
                preview.saveGallery({
                  base,
                  entries,
                  deletedPhotoIds,
                  replacement,
                });
                onDone();
              } catch (error) {
                setError(previewMessage(error));
              }
            }}
          >
            Done
          </Button>
        </div>
      </footer>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent
          role="alertdialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (deleteTrigger.current?.isConnected)
              deleteTrigger.current.focus();
            else title.current?.focus();
          }}
        >
          <DialogTitle>Delete Photograph?</DialogTitle>
          {deleting && (
            <div className="margin-gallery-delete-preview">
              <Image
                {...deleting.image}
                alt={deleting.description}
                unoptimized={deleting.kind === "local"}
                width={80}
                height={80}
                sizes="80px"
              />
              <p>{photoLabel(deleting)}</p>
            </div>
          )}
          <DialogDescription>
            This photograph will be removed from your gallery, photo library,
            posts, and drafts when you choose Done. Post text and conversations
            stay. Cancel arranging to keep it.
          </DialogDescription>
          <div className="margin-form-actions">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                cancelDrag();
                const ids = entries
                  .filter(
                    (entry) =>
                      photo(entry.photoId).image.src === deleting.image.src,
                  )
                  .map((entry) => entry.photoId);
                const next = entries.filter(
                  (entry) => !ids.includes(entry.photoId),
                );
                if (addition && needsReplacement)
                  next.push({ photoId: addition.id, featured: false });
                setDeletedPhotoIds((current) => [...current, ...ids]);
                setSelectedId(null);
                setDeleting(null);
                change(
                  next,
                  "Photograph marked for deletion. Choose Done to save or Cancel to keep it.",
                );
              }}
            >
              Delete photograph
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}
