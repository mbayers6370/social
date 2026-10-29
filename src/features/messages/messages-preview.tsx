"use client";

import { usePreview } from "@/features/local-preview/provider";
import { friendStatus } from "@/features/friends/model";
import { createLocalId } from "@/lib/local-id";

import Link from "next/link";
import { PersonLink, profileHref } from "@/components/shared/person-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ArrowUp,
  BookOpen,
  Download,
  Info,
  Mail,
} from "lucide-react";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar } from "@/features/feed/post-content";
import { dayKey, postTime } from "@/features/feed/format";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/shared/coming-soon";
import { continuesMessageGroup } from "./format";
import { FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  messageInputSchema,
  type MessageInput,
  type PreviewMessage,
  type PreviewThread,
} from "./schema";

export function MessagesPreview({
  threads: sampleThreads,
}: {
  threads: PreviewThread[];
}) {
  const {
    state,
    bootstrap,
    messageDrafts,
    updateMessageDraft,
    notebookNotes,
    addNotebookNote,
  } = usePreview();
  const threads: PreviewThread[] = [
    ...sampleThreads,
    ...state.profiles
      .filter(
        (profile) =>
          friendStatus(
            bootstrap.viewerId,
            profile.person.id,
            state.friendships,
          ) === "friends" &&
          !sampleThreads.some(
            (thread) => thread.contact.id === profile.person.id,
          ),
      )
      .map((profile) => ({
        id: profile.person.id,
        contact: profile.person,
        unread: false,
        messages: [],
      })),
  ].sort(
    (first, second) =>
      Number(second.contact.id === bootstrap.viewerId) -
      Number(first.contact.id === bootstrap.viewerId),
  );
  const router = useRouter();
  const params = useSearchParams();
  const selected = threads.find((thread) => thread.id === params.get("thread"));
  const active = selected ?? threads[0];
  const notebook = active.contact.id === bootstrap.viewerId;
  const unavailable = Boolean(params.get("thread") && !selected);
  const relationship = friendStatus(
    bootstrap.viewerId,
    active.contact.id,
    state.friendships,
  );
  const canMessage = relationship === "friends" || relationship === "self";
  const [local, setLocal] = useState<Record<string, PreviewMessage[]>>({});
  const [read, setRead] = useState<string[]>([]);
  const [exportNotice, setExportNotice] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(false);
  const noticeTrigger = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const messages = [
    ...active.messages,
    ...(notebook ? notebookNotes : (local[active.id] ?? [])),
  ];
  const localCount = notebook
    ? notebookNotes.length
    : (local[active.id]?.length ?? 0);
  const selectedId = selected?.id;
  const lastSelected = useRef(selectedId);
  const previousThread = useRef(active.id);
  const keepAtBottom = useRef(true);

  useLayoutEffect(() => {
    if (previousThread.current !== active.id) keepAtBottom.current = true;
    previousThread.current = active.id;
    const viewport = scroll.current;
    if (viewport?.clientHeight && keepAtBottom.current)
      viewport.scrollTop = viewport.scrollHeight;
  }, [active.id, localCount, selectedId]);

  useLayoutEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    let height = viewport.clientHeight;
    let width = viewport.clientWidth;
    const observer = new ResizeObserver(() => {
      if (viewport.clientHeight === height && viewport.clientWidth === width)
        return;
      height = viewport.clientHeight;
      width = viewport.clientWidth;
      // Growing the composer keeps the latest exchange visible, but never
      // pulls a reader away from older messages they scrolled up to read.
      if (height && keepAtBottom.current)
        viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selectedId && !window.matchMedia("(min-width: 1024px)").matches)
      back.current?.focus({ preventScroll: true });
    else if (!selectedId && lastSelected.current)
      document
        .getElementById(`thread-${lastSelected.current}`)
        ?.focus({ preventScroll: true });
    lastSelected.current = selectedId;
  }, [selectedId]);

  function openThread(id: string) {
    setRead((current) => (current.includes(id) ? current : [...current, id]));
    router.push(`/?view=messages&thread=${id}`, { scroll: false });
  }
  function closeThread() {
    router.push("/?view=messages", { scroll: false });
  }

  const previewNotice = (placement: "inbox" | "thread") => (
    <Button
      variant="ghost"
      className={`margin-message-preview-notice margin-message-preview-notice-${placement}`}
      aria-label="About this preview"
      onClick={(event) => {
        noticeTrigger.current = event.currentTarget;
        setPreviewInfo(true);
      }}
    >
      <Info aria-hidden="true" strokeWidth={1.5} />
      Local preview
    </Button>
  );

  if (unavailable)
    return (
      <section
        className="margin-messages"
        data-unavailable="true"
        aria-label="Messages preview"
      >
        <h1>Conversation unavailable</h1>
        <p>You can start a new conversation from a friend’s profile.</p>
        <Link href="/?view=messages">Back to messages</Link>
      </section>
    );

  return (
    <section
      className="margin-messages"
      data-thread-open={Boolean(selected)}
      aria-label="Messages preview"
    >
      <aside className="margin-inbox" aria-labelledby="messages-title">
        <div className="margin-messages-heading">
          <SectionTitle
            as="h1"
            id="messages-title"
            motif={<SectionMotif icon={Mail} />}
          >
            Messages
          </SectionTitle>
          {previewNotice("inbox")}
        </div>
        <p className="margin-inbox-description">
          A little space for a conversation.
        </p>
        <ul className="margin-thread-list" aria-label="Conversations">
          {threads.map((thread) => {
            const self = thread.contact.id === bootstrap.viewerId;
            const items = [
              ...thread.messages,
              ...(self ? notebookNotes : (local[thread.id] ?? [])),
            ];
            const latest = items[items.length - 1];
            const unread = !self && thread.unread && !read.includes(thread.id);
            return (
              <li key={thread.id}>
                <div
                  className="margin-thread-choice"
                  data-active={active.id === thread.id}
                  data-unread={unread}
                >
                  {self ? (
                    <span className="margin-notebook-icon" aria-hidden="true">
                      <BookOpen strokeWidth={1.5} />
                    </span>
                  ) : (
                    <Avatar person={thread.contact} linked />
                  )}
                  <span className="margin-thread-preview">
                    <strong>
                      {self ? (
                        "Notebook"
                      ) : (
                        <PersonLink person={thread.contact}>
                          {thread.contact.name}
                        </PersonLink>
                      )}
                      {unread && (
                        <span className="margin-unread-dot">
                          <span className="sr-only">Unread</span>
                        </span>
                      )}
                    </strong>
                    <button
                      id={`thread-${thread.id}`}
                      type="button"
                      className="margin-thread-open"
                      aria-label={
                        self
                          ? "Open notebook"
                          : `Open conversation with ${thread.contact.name}`
                      }
                      aria-current={
                        active.id === thread.id ? "true" : undefined
                      }
                      onClick={() => openThread(thread.id)}
                    >
                      {latest?.body ??
                        (self
                          ? "A little space for your thoughts."
                          : "Start a conversation.")}
                    </button>
                  </span>
                  {latest && (
                    <time dateTime={latest.createdAt}>
                      {dayKey(latest.createdAt) === "2026-10-27"
                        ? postTime(latest.createdAt)
                        : new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            timeZone: "America/Los_Angeles",
                          }).format(new Date(latest.createdAt))}
                    </time>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
      <section
        className="margin-thread"
        data-notebook={notebook || undefined}
        aria-label={
          notebook ? "Notebook" : `Conversation with ${active.contact.name}`
        }
      >
        <header className="margin-thread-header">
          <Button
            ref={back}
            variant="ghost"
            size="icon"
            className="margin-thread-back"
            aria-label="Back to messages"
            onClick={closeThread}
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
          </Button>
          {notebook ? (
            <span className="margin-notebook-icon" aria-hidden="true">
              <BookOpen strokeWidth={1.5} />
            </span>
          ) : (
            <Avatar person={active.contact} linked />
          )}
          <div className="margin-thread-person">
            <h2>
              {notebook ? (
                "Notebook"
              ) : (
                <PersonLink person={active.contact}>
                  {active.contact.name}
                </PersonLink>
              )}
            </h2>
            <div className="margin-thread-links">
              {notebook ? (
                <span>Notes to self</span>
              ) : (
                <Link href={profileHref(active.contact.id)}>View profile</Link>
              )}
              {previewNotice("thread")}
            </div>
          </div>
          {!notebook && (
            <Button
              ref={exportButton}
              variant="ghost"
              className="margin-deferred-action"
              aria-label="Export conversation"
              aria-description="Not available in this preview"
              onClick={() => setExportNotice(true)}
            >
              <Download aria-hidden="true" />
              <ComingSoon />
            </Button>
          )}
        </header>
        <div
          ref={scroll}
          className="margin-thread-scroll"
          role="region"
          aria-label={notebook ? "Notebook history" : "Message history"}
          tabIndex={0}
          onScroll={(event) => {
            const viewport = event.currentTarget;
            if (!viewport.clientHeight) return;
            keepAtBottom.current =
              viewport.scrollHeight -
                viewport.clientHeight -
                viewport.scrollTop <=
              24;
          }}
        >
          {!messages.length && (
            <p className="margin-message-empty">
              {notebook
                ? "A little space for your thoughts. Write your first note below."
                : `No messages yet. Say hello to ${active.contact.name.split(" ")[0]}.`}
            </p>
          )}
          <ol
            className="margin-message-log"
            aria-label={
              notebook
                ? "Notebook entries"
                : `Messages with ${active.contact.name}`
            }
          >
            {messages.map((message, index) => {
              const date = dayKey(message.createdAt);
              const previous = messages[index - 1];
              const next = messages[index + 1];
              const showTime = !next || !continuesMessageGroup(message, next);
              return (
                <li
                  key={message.id}
                  className="margin-message-row"
                  data-direction={notebook ? "outgoing" : message.direction}
                  data-group-start={!continuesMessageGroup(previous, message)}
                >
                  {(!previous || dayKey(previous.createdAt) !== date) && (
                    <h3 className="margin-message-day">
                      {date === "2026-10-27"
                        ? "Today"
                        : date === "2026-10-26"
                          ? "Yesterday"
                          : new Intl.DateTimeFormat("en-GB", {
                              day: "numeric",
                              month: "long",
                              timeZone: "America/Los_Angeles",
                            }).format(new Date(message.createdAt))}
                    </h3>
                  )}
                  <p className="margin-message-bubble">
                    <span className="sr-only">
                      {message.direction === "outgoing"
                        ? "You"
                        : active.contact.name}
                      :{" "}
                    </span>
                    {message.body}
                  </p>
                  {showTime && (
                    <time dateTime={message.createdAt}>
                      {postTime(message.createdAt)}
                    </time>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        {canMessage ? (
          <MessageComposer
            key={active.id}
            name={active.contact.name}
            notebook={notebook}
            draft={messageDrafts[active.id] ?? ""}
            onDraft={(body) => updateMessageDraft(active.id, body)}
            onSend={(body) => {
              if (!canMessage) return;
              // Sending is explicit: show the newly added local message.
              keepAtBottom.current = true;
              if (notebook) addNotebookNote(body);
              else
                setLocal((current) => ({
                  ...current,
                  [active.id]: [
                    ...(current[active.id] ?? []),
                    {
                      id: createLocalId(),
                      body,
                      direction: "outgoing",
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }));
              updateMessageDraft(active.id, "");
            }}
          />
        ) : (
          <p role="status" className="margin-message-unavailable">
            {relationship === "blocked"
              ? "Messaging is unavailable for this profile."
              : "You’re no longer friends. Your conversation history is still here; become friends again to send a message."}
          </p>
        )}
      </section>
      <Dialog open={previewInfo} onOpenChange={setPreviewInfo}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            noticeTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>About this preview</DialogTitle>
            <DialogDescription>
              These are fictional conversations. Nothing is sent to another
              person.
            </DialogDescription>
          </DialogHeader>
          <p>
            Unsent drafts stay in this tab while you visit profiles or other
            pages. Refreshing clears them.
          </p>
          <p>
            Notebook entries stay in this tab while you visit other pages and
            reset on refresh. Nothing is sent to anyone.
          </p>
          <p>
            Messages you add to a conversation reset when you leave Messages or
            refresh. Automatic deletion and conversation exports aren’t
            connected yet.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={exportNotice} onOpenChange={setExportNotice}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            exportButton.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>Conversation export</DialogTitle>
            <DialogDescription>
              This is a sample conversation. Exporting real messages will be
              available when private messaging is connected.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MessageComposer({
  name,
  notebook = false,
  draft,
  onDraft,
  onSend,
}: {
  name: string;
  notebook?: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (value: string) => void;
}) {
  const [sent, setSent] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MessageInput>({
    resolver: zodResolver(messageInputSchema),
    defaultValues: { body: draft },
  });
  const field = register("body", {
    onChange: (event) => {
      onDraft(event.target.value);
      setSent(false);
    },
  });

  useLayoutEffect(() => {
    if (textarea.current) fitMessageInput(textarea.current);
  }, [draft]);

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    // Refit wrapped drafts after resizing or opening a hidden mobile thread.
    // Ignore height changes from fitting the field itself.
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      fitMessageInput(input);
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, []);

  return (
    <form
      className="margin-message-composer"
      noValidate
      onSubmit={handleSubmit(({ body }) => {
        onSend(body);
        reset({ body: "" });
        setSent(true);
      })}
    >
      <label htmlFor="message-body" className="margin-field-label">
        {notebook ? "Note to self" : `Message to ${name}`}
      </label>
      <div className="margin-message-input" data-field>
        <textarea
          {...field}
          ref={(node) => {
            field.ref(node);
            textarea.current = node;
          }}
          id="message-body"
          rows={1}
          maxLength={2000}
          placeholder={
            notebook ? "Write a note…" : `Write to ${name.split(" ")[0]}…`
          }
          aria-invalid={Boolean(errors.body)}
          aria-describedby={`message-hint${errors.body ? " message-error" : ""}`}
        />
        <Button
          type="submit"
          aria-label={notebook ? "Save note" : "Add message to local preview"}
          className="margin-send"
        >
          <ArrowUp aria-hidden="true" />
          <span>{notebook ? "Save note" : "Send"}</span>
        </Button>
      </div>
      <p id="message-hint" className="sr-only">
        Expands up to three lines, then scrolls. Up to 2,000 characters.
        {notebook
          ? " Notes stay in this tab and clear on refresh."
          : " This preview does not send messages."}
      </p>
      {errors.body && (
        <FieldError id="message-error">
          {notebook
            ? errors.body.message?.replace("message", "note")
            : errors.body.message}
        </FieldError>
      )}
      <p role="status" className="margin-status">
        {sent
          ? notebook
            ? "Note saved in this tab."
            : "Added to the local preview."
          : ""}
      </p>
    </form>
  );
}

function fitMessageInput(input: HTMLTextAreaElement) {
  if (!input.clientWidth) return;
  const scrollTop = input.scrollTop;
  // Measure natural content height; CSS caps the visible area at three lines.
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
  input.scrollTop = scrollTop;
}
