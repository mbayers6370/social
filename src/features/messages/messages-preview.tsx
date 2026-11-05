"use client";

import { usePreview } from "@/features/local-preview/provider";
import { friendStatus } from "@/features/friends/model";

import Link from "next/link";
import { PersonLink, profileHref } from "@/components/shared/person-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  NotebookAnimated,
  Info,
  Message,
} from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { Avatar } from "@/features/feed/post-content";
import { dayKey, postTime } from "@/features/feed/format";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "./message-composer";
import { MessageRetention } from "./message-retention";
import { ConversationActions } from "./conversation-actions";
import { AccountDownload } from "@/features/settings/account-download";
import { MessageLog } from "./message-log";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type PreviewThread } from "./schema";

export function MessagesPreview({
  threads: sampleThreads,
}: {
  threads: PreviewThread[];
}) {
  const {
    state,
    freshStart,
    threads: accountThreads,
    bootstrap,
    messageDrafts,
    updateMessageDraft,
    notebookNotes,
    addNotebookNote,
    messageAdditions: local,
    sendMessage,
  } = usePreview();
  const baseThreads = freshStart ? accountThreads : sampleThreads;
  const threads: PreviewThread[] = [
    ...baseThreads,
    ...state.profiles
      .filter(
        (profile) =>
          friendStatus(
            bootstrap.viewerId,
            profile.person.id,
            state.friendships,
          ) === "friends" &&
          !baseThreads.some(
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
  const [read, setRead] = useState<string[]>([]);
  const [previewInfo, setPreviewInfo] = useState(false);
  const noticeTrigger = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
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
    router.replace("/?view=messages", { scroll: false });
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
      <Info aria-hidden="true" />
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
            motif={<SectionMotif icon={Message} />}
          >
            Messages
          </SectionTitle>
          {previewNotice("inbox")}
        </div>
        <p className="margin-inbox-description">
          Your conversations and private notes.
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
                  data-notebook={self || undefined}
                  data-active={active.id === thread.id}
                  data-unread={unread}
                >
                  {self ? (
                    <span className="margin-notebook-icon" aria-hidden="true">
                      <NotebookAnimated animate />
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
                        (self ? "Notes to self" : "Start a conversation.")}
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
            <ChevronLeft aria-hidden="true" />
          </Button>
          {notebook ? (
            <span className="margin-notebook-icon" aria-hidden="true">
              <NotebookAnimated animate />
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
          {!notebook && <ConversationActions key={active.id} thread={active} />}
        </header>
        <MessageRetention
          notebook={notebook}
          exportAction={
            !notebook && (
              <AccountDownload
                key={active.id}
                conversationId={active.id}
                trigger={
                  <button type="button" className="margin-message-export">
                    Export conversation
                  </button>
                }
              />
            )
          }
        />
        <div
          ref={scroll}
          className="margin-thread-scroll"
          role="region"
          aria-label={notebook ? "Notebook history" : "Message history"}
          aria-describedby="message-retention"
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
                ? "Nothing here yet."
                : `No messages yet. Say hello to ${active.contact.name.split(" ")[0]}.`}
            </p>
          )}
          <MessageLog
            messages={messages}
            notebook={notebook}
            name={active.contact.name}
            referenceTime="2026-10-27T12:00:00-07:00"
          />
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
              else sendMessage(active.contact.id, body);
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
            Messages you add stay in this tab until you refresh. Automatic
            deletion is not connected yet. You can export your conversations
            using Download.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
