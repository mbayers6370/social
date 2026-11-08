"use client";
import { useInteractionRefresh } from "@/hooks/use-interaction-refresh";
import { createRequestId } from "@/lib/local-id";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Message,
  NotebookAnimated,
  Refresh,
} from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { PersonLink } from "@/components/shared/person-link";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { Avatar } from "@/features/feed/post-content";
import { MessageComposer } from "@/features/messages/message-composer";
import { MessageRetention } from "@/features/messages/message-retention";
import { MessageLog } from "@/features/messages/message-log";
import { useSpaceClient } from "@/features/spaces/client";
import {
  MemberRequestError,
  memberJson,
  requestMember,
  memberChanged,
} from "./member-client";
import { MemberConversationMenu } from "./member-conversation-menu";
import { MemberConversationExport } from "./member-conversation-export";
import { MessagingOff } from "./messaging-off";
import { useMember } from "./member-provider";
import type { MemberConversation, MemberThread } from "./member-contracts";

export function MemberMessages({
  initialThreads,
  initialConversation,
  selectedId,
  referenceTime,
  initialNextCursor = null,
  onSelect,
}: {
  initialThreads: MemberThread[];
  initialConversation: MemberConversation | null;
  selectedId?: string;
  referenceTime: string;
  initialNextCursor?: string | null;
  onSelect?: (id?: string) => void;
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const member = useMember();
  const reloadIdentity = member?.reload;
  const messagingEnabled =
    member?.identity.preferences.messagingEnabled !== false;
  const active = initialConversation?.thread ?? initialThreads[0];
  const [latestThreads, setLatestThreads] = useState<{
    source: MemberThread[];
    rows: MemberThread[];
    cursor: string | null;
  } | null>(null);
  const [inboxError, setInboxError] = useState("");
  const baseThreads =
    latestThreads?.source === initialThreads
      ? latestThreads.rows
      : initialThreads;
  const [moreThreads, setMoreThreads] = useState<{
    source: MemberThread[];
    rows: MemberThread[];
    cursor: string | null;
  } | null>(null);
  const displayedThreads =
    moreThreads?.source === initialThreads
      ? [
          ...new Map(
            [...baseThreads, ...moreThreads.rows].map((thread) => [
              thread.id,
              thread,
            ]),
          ).values(),
        ]
      : baseThreads;
  const nextThreadCursor =
    moreThreads?.source === initialThreads
      ? moreThreads.cursor
      : latestThreads?.source === initialThreads
        ? latestThreads.cursor
        : initialNextCursor;
  const [loaded, setLoaded] = useState<MemberConversation | null>(null);
  const [deniedId, setDeniedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [localDrafts, setLocalDrafts] = useState<Record<string, string>>({});
  const localAttempts = useRef<Record<string, { id: string; body: string }>>(
    {},
  );
  const denied = deniedId === active?.id;
  const data = denied
    ? null
    : loaded?.thread.id === active?.id
      ? loaded
      : initialConversation;
  const scroll = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const lastSelected = useRef(selectedId);
  const current = useRef(active?.id);
  const atBottom = useRef(true);
  const paginated = useRef(false);
  useLayoutEffect(() => {
    current.current = active?.id;
  }, [active?.id]);
  const read = useCallback(
    (id: string, before?: string, signal?: AbortSignal) =>
      requestMember<MemberConversation>(
        client,
        `/api/messages/${encodeURIComponent(id)}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
        { signal },
      ),
    [client],
  );
  const denyConversation = useCallback(
    (id: string, status: number) => {
      setDeniedId(id);
      setLoaded(null);
      if (status === 403) void reloadIdentity?.().catch(() => undefined);
      setLatestThreads((previous) =>
        previous
          ? {
              ...previous,
              rows: previous.rows.filter((thread) => thread.id !== id),
            }
          : {
              source: initialThreads,
              rows: initialThreads.filter((thread) => thread.id !== id),
              cursor: initialNextCursor,
            },
      );
    },
    [reloadIdentity, initialThreads, initialNextCursor],
  );
  const close = useCallback(
    () =>
      onSelect
        ? onSelect()
        : router.replace("/app/messages", { scroll: false }),
    [router, onSelect],
  );
  const loadInbox = useCallback(
    async (signal: AbortSignal) => {
      try {
        const result = await requestMember<{
          threads: MemberThread[];
          nextCursor: string | null;
        }>(client, "/api/messages", { signal });
        if (!signal.aborted) {
          setLatestThreads({
            source: initialThreads,
            rows: result.threads,
            cursor: result.nextCursor,
          });
          setInboxError("");
        }
      } catch (error) {
        if (error instanceof MemberRequestError && error.status === 403)
          void reloadIdentity?.().catch(() => undefined);
        if (!signal.aborted)
          setInboxError(
            "The conversation list couldn’t refresh. Your open conversation is still here.",
          );
      }
    },
    [client, initialThreads, reloadIdentity],
  );
  useInteractionRefresh(loadInbox, {
    enabled: messagingEnabled,
    initial: false,
  });
  const activeId = active?.id;
  const loadConversation = useCallback(
    async (signal: AbortSignal) => {
      const id = activeId;
      if (!id) return;
      try {
        const result = await read(id, undefined, signal);
        if (signal.aborted || current.current !== id) return;
        setDeniedId(null);
        setLoaded((previous) =>
          paginated.current && previous?.thread.id === id
            ? {
                ...result,
                nextCursor: previous.nextCursor,
                messages: [
                  ...new Map(
                    [...previous.messages, ...result.messages].map(
                      (message) => [message.id, message],
                    ),
                  ).values(),
                ],
              }
            : result,
        );
        setError("");
        const through = result.messages.at(-1)?.id;
        if (result.thread.unread && through) {
          await requestMember(
            client,
            "/api/messages/" + encodeURIComponent(id) + "/read",
            memberJson("PUT", { through }),
          );
          memberChanged();
        }
      } catch (error) {
        if (!signal.aborted && current.current === id) {
          if (
            error instanceof MemberRequestError &&
            [401, 403, 404].includes(error.status)
          )
            denyConversation(id, error.status);
          setError(
            error instanceof Error
              ? error.message
              : "Messages could not be loaded.",
          );
        }
      }
    },
    [activeId, read, denyConversation, client],
  );
  const { refresh: refreshConversation, refreshing } = useInteractionRefresh(
    loadConversation,
    { enabled: messagingEnabled && Boolean(activeId), scope: activeId },
  );
  useEffect(() => {
    if (selectedId && !window.matchMedia("(min-width: 1024px)").matches)
      back.current?.focus({ preventScroll: true });
    else if (!selectedId && lastSelected.current)
      document
        .getElementById(`thread-${lastSelected.current}`)
        ?.focus({ preventScroll: true });
    lastSelected.current = selectedId;
    if (!selectedId) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selectedId, close]);
  useLayoutEffect(() => {
    if (scroll.current && atBottom.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [data?.messages.length, active?.id]);
  const drafts = member?.messageDrafts ?? localDrafts;
  const updateDraft = (id: string, body: string) =>
    member
      ? member.updateMessageDraft(id, body)
      : setLocalDrafts((previous) => ({ ...previous, [id]: body }));
  if (!messagingEnabled)
    return (
      <LiveAppShell active="messages">
        <MessagingOff />
      </LiveAppShell>
    );
  if (!active)
    return (
      <LiveAppShell active="messages">
        <section className="margin-messages">
          <h1>Messages unavailable</h1>
          <Link href="/app/messages">Try again</Link>
        </section>
      </LiveAppShell>
    );
  return (
    <LiveAppShell active="messages">
      <section
        className="margin-messages"
        data-thread-open={Boolean(selectedId)}
        aria-label="Messages"
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
          </div>
          <p className="margin-inbox-description">
            Your conversations and private notes.
          </p>
          {inboxError && <p role="status">{inboxError}</p>}
          <ul className="margin-thread-list" aria-label="Conversations">
            {displayedThreads
              .filter((thread) => thread.id !== deniedId)
              .map((thread) => (
                <li key={thread.id}>
                  <div
                    className="margin-thread-choice"
                    data-notebook={thread.notebook || undefined}
                    data-active={active.id === thread.id}
                    data-unread={thread.unread}
                  >
                    {thread.notebook ? (
                      <span className="margin-notebook-icon" aria-hidden="true">
                        <NotebookAnimated animate />
                      </span>
                    ) : (
                      <Avatar person={thread.contact} linked live />
                    )}
                    <span className="margin-thread-preview">
                      <strong>
                        {thread.notebook ? (
                          "Notebook"
                        ) : (
                          <PersonLink live person={thread.contact}>
                            {thread.contact.name}
                          </PersonLink>
                        )}
                      </strong>
                      <button
                        id={`thread-${thread.id}`}
                        type="button"
                        className="margin-thread-open"
                        aria-label={
                          thread.notebook
                            ? "Open notebook"
                            : `Open conversation with ${thread.contact.name}`
                        }
                        aria-current={
                          active.id === thread.id ? "true" : undefined
                        }
                        onClick={() => {
                          paginated.current = false;
                          atBottom.current = true;
                          if (onSelect) onSelect(thread.id);
                          else
                            router.push(
                              `/app/messages?thread=${encodeURIComponent(thread.id)}`,
                              { scroll: false },
                            );
                        }}
                      >
                        {thread.preview ||
                          (thread.notebook
                            ? "Notes to self"
                            : "Start a conversation.")}
                      </button>
                    </span>
                    {thread.updatedAt && (
                      <time dateTime={thread.updatedAt}>
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "numeric",
                          month: "short",
                          timeZone: "America/Los_Angeles",
                        }).format(new Date(thread.updatedAt))}
                      </time>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          {nextThreadCursor && (
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  const next = await requestMember<{
                    threads: MemberThread[];
                    nextCursor: string | null;
                  }>(
                    client,
                    `/api/messages?before=${encodeURIComponent(nextThreadCursor)}`,
                  );
                  setMoreThreads({
                    source: initialThreads,
                    rows: [
                      ...(moreThreads?.source === initialThreads
                        ? moreThreads.rows
                        : []),
                      ...next.threads,
                    ],
                    cursor: next.nextCursor,
                  });
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t load more conversations.",
                  );
                }
              }}
            >
              More conversations
            </Button>
          )}
        </aside>
        <section
          className="margin-thread"
          data-notebook={active.notebook || undefined}
          aria-label={
            active.notebook
              ? "Notebook"
              : `Conversation with ${active.contact.name}`
          }
        >
          <header className="margin-thread-header">
            <Button
              ref={back}
              className="margin-thread-back"
              variant="ghost"
              size="icon"
              aria-label="Back to messages"
              onClick={close}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div className="margin-thread-identity">
              {active.notebook ? (
                <span className="margin-notebook-icon" aria-hidden="true">
                  <NotebookAnimated animate />
                </span>
              ) : (
                <Avatar live linked person={active.contact} />
              )}
              <div className="margin-thread-person">
                <h2>
                  {active.notebook ? (
                    "Notebook"
                  ) : (
                    <PersonLink live person={active.contact}>
                      {active.contact.name}
                    </PersonLink>
                  )}
                </h2>
                <div className="margin-thread-links">
                  {active.notebook ? (
                    <span>Notes to self</span>
                  ) : (
                    <Link
                      href={`/app?person=${encodeURIComponent(active.contact.id)}`}
                    >
                      View profile
                    </Link>
                  )}
                </div>
              </div>
            </div>
            {!active.notebook && (
              <div className="margin-thread-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  className="margin-thread-refresh"
                  aria-label="Refresh conversation"
                  title={
                    refreshing
                      ? "Refreshing conversation…"
                      : "Refresh conversation"
                  }
                  aria-busy={refreshing}
                  disabled={refreshing}
                  onClick={() => void refreshConversation()}
                >
                  <Refresh aria-hidden="true" />
                </Button>
                {data && (
                  <MemberConversationMenu
                    data={data}
                    onCleared={async () => {
                      paginated.current = false;
                      setLoaded(await read(active.id));
                      router.refresh();
                    }}
                  />
                )}
              </div>
            )}
          </header>
          <MessageRetention
            notebook={active.notebook}
            exportAction={
              !denied &&
              !active.notebook && (
                <MemberConversationExport
                  key={active.id}
                  threadId={active.id}
                />
              )
            }
          />
          <div
            ref={scroll}
            className="margin-thread-scroll"
            role="region"
            aria-label={
              active.notebook ? "Notebook history" : "Message history"
            }
            aria-describedby="message-retention"
            tabIndex={0}
            onScroll={(event) => {
              const element = event.currentTarget;
              atBottom.current =
                element.scrollHeight -
                  element.clientHeight -
                  element.scrollTop <=
                24;
            }}
          >
            {error && <p role="alert">{error}</p>}
            {data?.nextCursor && (
              <Button
                variant="outline"
                disabled={loadingOlder}
                onClick={async () => {
                  if (!data?.nextCursor) return;
                  setLoadingOlder(true);
                  const id = active.id;
                  const height = scroll.current?.scrollHeight ?? 0;
                  try {
                    const older = await read(id, data.nextCursor);
                    if (current.current !== id) return;
                    paginated.current = true;
                    atBottom.current = false;
                    setLoaded({
                      ...older,
                      messages: [...older.messages, ...data.messages],
                    });
                    requestAnimationFrame(() => {
                      if (scroll.current)
                        scroll.current.scrollTop +=
                          scroll.current.scrollHeight - height;
                    });
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Older messages are unavailable.",
                    );
                  } finally {
                    setLoadingOlder(false);
                  }
                }}
              >
                Older {active.notebook ? "notes" : "messages"}
              </Button>
            )}
            {denied ? (
              <p>
                This conversation is no longer available. Your draft is kept on
                this device while you remain signed in.
              </p>
            ) : !data ? (
              <p role="status">Loading conversation…</p>
            ) : !data.messages.length ? (
              <p className="margin-message-empty">
                {active.notebook
                  ? "Nothing here yet."
                  : `No messages yet. Say hello to ${active.contact.name.split(" ")[0]}.`}
              </p>
            ) : (
              <MessageLog
                messages={data.messages}
                notebook={active.notebook}
                name={active.contact.name}
                referenceTime={referenceTime}
              />
            )}
          </div>
          {!denied && (data?.thread.canSend ?? active.canSend) ? (
            <MessageComposer
              key={active.id}
              live
              notebook={active.notebook}
              name={active.contact.name}
              draft={drafts[active.id] ?? ""}
              onDraft={(body) => updateDraft(active.id, body)}
              onSend={async (body) => {
                const id = active.id;
                const previous = localAttempts.current[id];
                if (previous && previous.body !== body)
                  throw Error(
                    "The previous delivery is uncertain. Retry that unchanged draft before sending a different message.",
                  );
                const attempt = member
                  ? member.messageAttempt(id, body)
                  : (localAttempts.current[id] ??= previous ?? {
                      id: createRequestId(),
                      body,
                    });
                try {
                  await requestMember(
                    client,
                    `/api/messages/${encodeURIComponent(id)}`,
                    memberJson("POST", { body, requestId: attempt.id }),
                  );
                  if (member) member.clearMessageAttempt(id);
                  else delete localAttempts.current[id];
                  updateDraft(id, "");
                  paginated.current = false;
                  atBottom.current = true;
                  try {
                    const latest = await read(id);
                    if (current.current === id) setLoaded(latest);
                  } catch {
                    setError(
                      "Your message was sent. The latest conversation could not be loaded; try refreshing.",
                    );
                  }
                  memberChanged();
                  router.refresh();
                } catch (error) {
                  if (
                    error instanceof MemberRequestError &&
                    [401, 403, 404].includes(error.status)
                  ) {
                    denyConversation(id, error.status);
                    setError(error.message);
                  }
                  if (error instanceof MemberRequestError && !error.uncertain)
                    if (member) member.clearMessageAttempt(id);
                    else delete localAttempts.current[id];
                  throw error;
                }
              }}
            />
          ) : !denied && data ? (
            <p role="status" className="margin-message-unavailable">
              You can read your history. New messages require an accepted
              friendship and cannot be sent while either member has blocked the
              other.
            </p>
          ) : null}
        </section>
      </section>
    </LiveAppShell>
  );
}
