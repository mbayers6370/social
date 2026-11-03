"use client";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
  type Ref,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useMember } from "@/features/social/member-provider";
import {
  Image as ImageIcon,
  Close,
  ChevronDown,
} from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import type { Person } from "@/features/feed/schema";
import { ComposerEntry } from "@/features/compose/composer-entry";
import { ComposerSurface } from "@/features/compose/composer-surface";
import { useComposerLayout } from "@/features/compose/use-composer-layout";
import { SPACE_PHOTO_LIMIT } from "@/lib/platform-rules";
import { validateLocalPhoto } from "@/features/local-preview/upload";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";
import { SpacePhotoPicker, type SpaceDraftPhoto } from "./space-photo-picker";

export type SpaceComposerHandle = { open: (trigger?: HTMLElement) => void };
export function SpaceComposer({
  spaceId = "",
  personal = false,
  entryVisible = true,
  spaceName = "this Space",
  viewer = { id: "me", name: "You", initials: "Y", tone: "paper" },
  ref,
}: {
  spaceId?: string;
  personal?: boolean;
  entryVisible?: boolean;
  spaceName?: string;
  viewer?: Person;
  ref?: Ref<SpaceComposerHandle>;
}) {
  const id = useId();
  const identity = useMember();
  const currentViewer = identity?.identity.person ?? viewer;
  const [link, setLink] = useState(false);
  const [url, setUrl] = useState("");
  const [published, setPublished] = useState(false);
  // A profile opens from its New Post button in a dialog at every width.
  const desktop = useComposerLayout() && entryVisible;
  const client = useSpaceClient();
  const action = useSpaceAction();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<SpaceDraftPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [initialFile, setInitialFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState("");
  const externalTrigger = useRef<HTMLElement | null>(null);
  const prompt = useRef<HTMLButtonElement>(null);
  const photoTrigger = useRef<HTMLButtonElement>(null);
  const addPhoto = useRef<HTMLButtonElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (validation || action.error) feedback.current?.focus();
  }, [validation, action.error]);
  const returnTo = useRef(false);
  const returningFocus = useRef(false);
  const alive = useRef(true);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    const retained = urls.current;
    return () => {
      alive.current = false;
      retained.forEach(URL.revokeObjectURL);
      retained.clear();
    };
  }, []);
  function restoreFocus() {
    (externalTrigger.current?.isConnected
      ? externalTrigger.current
      : (returnTo.current ? photoTrigger : prompt).current
    )?.focus({
      preventScroll: true,
    });
  }
  function close() {
    if (action.busy) return;
    returningFocus.current = true;
    setOpen(false);
    setPicking(false);
    setInitialFile(undefined);
  }
  useEffect(() => {
    if (open || action.busy || !returningFocus.current) return;
    const frame = requestAnimationFrame(() => {
      returningFocus.current = false;
      (externalTrigger.current?.isConnected
        ? externalTrigger.current
        : (returnTo.current ? photoTrigger : prompt).current
      )?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, action.busy]);
  function activate(photo: boolean) {
    returnTo.current = photo;
    if (photo) setLink(false);
    setValidation("");
    setOpen(true);
    setPicking(photo && photos.length < 3 && !action.uncertain);
  }
  useImperativeHandle(ref, () => ({
    open: (trigger) => {
      externalTrigger.current = trigger ?? null;
      activate(false);
    },
  }));
  useEffect(() => {
    if (!open || !desktop || picking) return;
    const frame = requestAnimationFrame(() =>
      text.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, desktop, picking]);
  function acceptsDrop(event: DragEvent<HTMLDivElement>) {
    return desktop && event.dataTransfer.types.includes("Files");
  }
  function remove(index: number) {
    const photo = photos[index];
    if (photo.kind === "device") {
      URL.revokeObjectURL(photo.src);
      urls.current.delete(photo.src);
    }
    setPhotos((current) => current.filter((_, at) => at !== index));
  }
  return (
    <Dialog
      open={open && !desktop}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <ComposerEntry
        className="margin-space-composer"
        showPrompt={entryVisible}
        avatar={<Avatar person={currentViewer} live={!client.preview} />}
        open={open}
        desktop={desktop}
        busy={checking || action.busy}
        onOpen={activate}
        promptRef={prompt}
        photoRef={photoTrigger}
        role="group"
        aria-label={personal ? "Share with friends" : "Share with this Space"}
        aria-busy={checking}
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          if (!acceptsDrop(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = photos.length >= 3 ? "none" : "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={async (event) => {
          if (!acceptsDrop(event)) return;
          event.preventDefault();
          setDragging(false);
          if (open || checking || action.busy) return;
          const files = Array.from(event.dataTransfer.files);
          if (files.length !== 1 || photos.length >= 3) {
            setValidation(
              "Drop one photograph at a time, up to three per post.",
            );
            return;
          }
          setChecking(true);
          setValidation("");
          try {
            await validateLocalPhoto(files[0], "Dropped photograph");
            if (alive.current) {
              setInitialFile(files[0]);
              activate(true);
            }
          } catch (error) {
            if (alive.current)
              setValidation(
                error instanceof Error
                  ? error.message
                  : "That photograph could not be read.",
              );
          } finally {
            if (alive.current) setChecking(false);
          }
        }}
      >
        {open && (
          <ComposerSurface
            inline={desktop}
            feed
            onActivate={() => {
              if (!picking) text.current?.focus();
            }}
            onReturnFocus={restoreFocus}
            onCancel={picking || action.busy ? undefined : close}
          >
            <header className="margin-compose-header">
              {desktop ? (
                <div className="margin-compose-author">
                  <Avatar person={currentViewer} live={!client.preview} />
                  <h2 className="margin-compose-title">Your post</h2>
                </div>
              ) : (
                <>
                  <div className="margin-compose-heading">
                    <DialogTitle className="margin-compose-title">
                      New Post
                    </DialogTitle>
                  </div>
                  <DialogDescription className="sr-only">
                    {personal
                      ? "Share a personal post with your friends."
                      : `Share with the members of ${spaceName}.`}
                  </DialogDescription>
                  <div className="margin-compose-author">
                    <Avatar person={currentViewer} live={!client.preview} />
                    <div className="margin-compose-author-copy">
                      <strong>{currentViewer.name}</strong>
                      <span className="margin-note">
                        {personal
                          ? "Friends · Disappears after 30 days"
                          : spaceName}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </header>
            <form
              className="margin-compose-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setValidation("");
                if (!body.trim() && !photos.length) {
                  setValidation("Write a post or choose a photograph.");
                  text.current?.focus();
                  return;
                }
                if (personal && link) {
                  try {
                    const value = new URL(url);
                    if (
                      value.protocol !== "https:" ||
                      value.username ||
                      value.password
                    )
                      throw Error();
                  } catch {
                    setValidation(
                      "Use a complete HTTPS link without a username or password.",
                    );
                    return;
                  }
                  if (!body.trim()) {
                    setValidation(
                      "Write something about the link before sharing.",
                    );
                    return;
                  }
                }
                const input = {
                  body: `${body.trim()}${personal && link ? `\n\n${url.trim()}` : ""}`,
                  photoIds: photos.flatMap((photo) =>
                    photo.kind === "saved" ? [photo.photo.id] : [],
                  ),
                };
                const files = photos.filter((photo) => photo.kind === "device");
                let payload: typeof input | FormData = input;
                if (files.length) {
                  payload = new FormData();
                  payload.set("input", JSON.stringify(input));
                  for (const photo of files) {
                    payload.append("photos", photo.file);
                    payload.append("descriptions", photo.description);
                  }
                }
                if (
                  await action.run(
                    personal
                      ? "/api/posts/publish"
                      : `/api/spaces/${spaceId}/posts`,
                    "POST",
                    payload,
                    true,
                  )
                ) {
                  setBody("");
                  setUrl("");
                  setLink(false);
                  setPublished(true);
                  setPhotos([]);
                  urls.current.forEach(URL.revokeObjectURL);
                  urls.current.clear();
                  returningFocus.current = true;
                  setOpen(false);
                  setPicking(false);
                }
              }}
            >
              <div className="margin-compose-editor">
                {personal && (
                  <div
                    className="margin-compose-modes"
                    role="group"
                    aria-label="Post type"
                  >
                    <Button
                      variant="ghost"
                      aria-pressed={!link}
                      disabled={action.busy || action.uncertain}
                      onClick={() => setLink(false)}
                    >
                      Post
                    </Button>
                    <Button
                      variant="ghost"
                      aria-pressed={link}
                      disabled={action.busy || action.uncertain}
                      onClick={() => {
                        setLink(true);
                        setPhotos([]);
                        urls.current.forEach(URL.revokeObjectURL);
                        urls.current.clear();
                      }}
                    >
                      Link
                    </Button>
                  </div>
                )}
                <Label
                  htmlFor={`${id}-body`}
                  className={desktop ? "sr-only" : undefined}
                >
                  Your post
                </Label>
                <textarea
                  ref={text}
                  id={`${id}-body`}
                  className="margin-compose-body"
                  rows={5}
                  maxLength={personal ? 3000 : 2000}
                  placeholder="Something worth sharing…"
                  value={body}
                  disabled={action.busy || action.uncertain}
                  onChange={(event) => setBody(event.target.value)}
                />
                {personal && link && (
                  <>
                    <Label htmlFor={`${id}-url`}>Link</Label>
                    <Input
                      id={`${id}-url`}
                      type="url"
                      required
                      maxLength={2048}
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      disabled={action.busy || action.uncertain}
                      placeholder="https://"
                    />
                  </>
                )}
                {photos.length > 0 && (
                  <div className="margin-compose-photos">
                    {photos.map((item, index) => (
                      <div
                        className="margin-compose-photo"
                        key={item.kind === "saved" ? item.photo.id : item.src}
                      >
                        <Image
                          unoptimized
                          loading="eager"
                          src={
                            item.kind === "saved"
                              ? client.photoSrc(item.photo.id)
                              : item.src
                          }
                          alt={
                            item.kind === "saved"
                              ? item.photo.description
                              : item.description
                          }
                          width={
                            item.kind === "saved"
                              ? item.photo.width
                              : item.width
                          }
                          height={
                            item.kind === "saved"
                              ? item.photo.height
                              : item.height
                          }
                          sizes="200px"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`Remove photograph ${index + 1} from draft`}
                          disabled={action.busy || action.uncertain}
                          onClick={() => remove(index)}
                        >
                          <Close aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {(!personal || !link) && (
                  <div className="margin-compose-tools">
                    <Button
                      ref={addPhoto}
                      variant="outline"
                      disabled={
                        action.busy || action.uncertain || photos.length >= 3
                      }
                      onClick={() => {
                        setInitialFile(undefined);
                        setPicking(true);
                      }}
                    >
                      <ImageIcon aria-hidden="true" />
                      Add Photographs
                    </Button>
                    <p className="margin-field-hint">
                      {photos.length} of 3 photographs
                    </p>
                  </div>
                )}
                <details className="margin-compose-rules">
                  <summary>
                    Posting guidelines <ChevronDown aria-hidden="true" />
                  </summary>
                  <div>
                    {personal ? (
                      <>
                        <p>
                          Share up to three posts per day, or one
                          link-containing post as your only post that day. Posts
                          disappear after 30 days.
                        </p>
                        <p>
                          New photographs use your shared daily allowance of
                          three. Saved photographs can be reused. Your Gallery
                          keeps up to twenty photographs.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Shared with members of {spaceName}. Space posts don’t
                          use your personal post allowance.
                        </p>
                        <p>
                          New photographs count toward your three daily uploads
                          across Margin. Each Space holds up to{" "}
                          {SPACE_PHOTO_LIMIT} distinct photographs.
                        </p>
                      </>
                    )}
                  </div>
                </details>
                {(validation || action.error) && (
                  <p ref={feedback} role="alert" tabIndex={-1}>
                    {validation || action.error}
                  </p>
                )}
                {action.uncertain && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Reload to check saved changes
                  </Button>
                )}
              </div>
              <div className="margin-compose-actions">
                <div className="margin-form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={action.busy}
                    onClick={close}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={action.busy || action.uncertain}
                  >
                    {action.busy ? "Publishing…" : "Publish"}
                  </Button>
                </div>
              </div>
            </form>
            <SpacePhotoPicker
              spaceId={spaceId}
              libraryUrl={personal ? "/api/gallery/photos" : undefined}
              open={picking}
              initialFile={initialFile}
              selected={photos}
              onClose={() => {
                setPicking(false);
                setInitialFile(undefined);
              }}
              onReturnFocus={() =>
                addPhoto.current?.focus({ preventScroll: true })
              }
              onChoose={(photo) => {
                if (photo.kind === "device") urls.current.add(photo.src);
                setPhotos((current) => [...current, photo]);
                setPicking(false);
                setInitialFile(undefined);
              }}
            />
          </ComposerSurface>
        )}
        {!open && validation && (
          <p className="margin-feed-drop-notice" role="alert">
            {validation}
          </p>
        )}
        {(dragging || checking) && (
          <p className="margin-feed-drop-notice" role="status">
            {checking
              ? "Checking photograph…"
              : "Drop a photograph to start a post."}
          </p>
        )}
      </ComposerEntry>
      {personal && published && !open && (
        <p role="status" className="margin-field-hint">
          Post shared with friends. <Link href="/app">View your profile</Link>
        </p>
      )}
    </Dialog>
  );
}
