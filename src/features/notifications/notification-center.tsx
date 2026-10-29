"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Settings2,
  ShieldCheck,
  X,
  Clock3,
  Heart,
  MessageCircle,
  Reply,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { PersonLink, profileHref } from "@/components/shared/person-link";
import { relativeTime } from "@/features/feed/format";
import { usePreview } from "@/features/local-preview/provider";
import { createLocalId } from "@/lib/local-id";
import { FriendActions } from "@/features/friends/friend-actions";
import {
  notificationAvailable,
  notificationText,
  type LocalNotification,
} from "./model";
const DESKTOP = "(min-width: 1024px)";
const notificationIcons = {
  comment: MessageCircle,
  reply: Reply,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  like: Heart,
  account: ShieldCheck,
} satisfies Record<LocalNotification["kind"], LucideIcon>;
function subscribe(callback: () => void) {
  const query = window.matchMedia?.(DESKTOP);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}
const desktopSnapshot = () => window.matchMedia?.(DESKTOP).matches ?? false;

type HistoryEntry = { id: string };
export function NotificationCenter({
  placement,
}: {
  placement?: "header" | "navigation";
}) {
  const preview = usePreview();
  const router = useRouter();
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  const [localOpen, setLocalOpen] = useState(false);
  const open =
    placement === "header"
      ? preview.headerPanel === "notifications"
      : localOpen;
  const setHeaderPanel = preview.setHeaderPanel;
  const setOpen = useCallback(
    (value: boolean) => {
      if (placement === "header")
        setHeaderPanel((current) =>
          value
            ? "notifications"
            : current === "notifications"
              ? null
              : current,
        );
      else setLocalOpen(value);
    },
    [placement, setHeaderPanel],
  );
  const [status, setStatus] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const entry = useRef<HistoryEntry | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const navigating = useRef(false);
  const mode = useRef(false);
  const showing = useRef(false);
  const unread = preview.notificationRows.filter(
    (row) => !preview.notifications.readIds.includes(row.id),
  ).length;
  const flushNavigation = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    if (action) requestAnimationFrame(action);
  }, []);
  const close = useCallback(() => {
    showing.current = false;
    setOpen(false);
    if (
      entry.current &&
      window.history.state?.marginNotifications === entry.current.id
    )
      window.history.back();
    else {
      entry.current = null;
      flushNavigation();
    }
  }, [flushNavigation, setOpen]);
  useEffect(() => {
    function pop() {
      if (
        entry.current &&
        window.history.state?.marginNotifications !== entry.current.id
      ) {
        entry.current = null;
        showing.current = false;
        setOpen(false);
        flushNavigation();
      }
    }
    function resize() {
      if (showing.current && mode.current !== desktopSnapshot()) close();
    }
    window.addEventListener("popstate", pop);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("resize", resize);
    };
  }, [close, flushNavigation, setOpen]);
  function changeOpen(next: boolean) {
    if (!next) {
      close();
      return;
    }
    navigating.current = false;
    setStatus("");
    mode.current = desktopSnapshot();
    showing.current = true;
    if (!mode.current) {
      const id = createLocalId();
      entry.current = { id };
      window.history.pushState(
        { ...window.history.state, marginNotifications: id },
        "",
        "#notifications",
      );
    }
    setOpen(true);
  }
  function navigate(action: () => void) {
    navigating.current = true;
    pending.current = action;
    close();
  }
  function select(row: LocalNotification) {
    const available = notificationAvailable(
      row,
      preview.bootstrap.viewerId,
      preview.state.friendships,
      preview.now,
      preview.state.profiles.map((profile) => profile.person.id),
    );
    preview.markNotificationRead(row.id);
    if (!available) {
      setStatus("This content is no longer available.");
      return;
    }
    navigate(() => {
      if (row.target.kind === "conversation") {
        if (!preview.requestNotificationConversation(row.id)) return;
        const params = new URLSearchParams(window.location.search);
        const view = params.get("view");
        if (row.target.ownerId === preview.bootstrap.viewerId) {
          if (
            window.location.pathname !== "/" ||
            view !== "profile" ||
            (params.get("person") &&
              params.get("person") !== preview.bootstrap.viewerId)
          )
            router.push("/?view=profile", { scroll: false });
        } else if (
          window.location.pathname !== "/" ||
          (view && view !== "feed")
        )
          router.push("/", { scroll: false });
      } else if (row.target.kind === "profile")
        router.push(
          `/?view=profile&person=${encodeURIComponent(row.target.personId)}`,
        );
      else router.push("/?view=settings#privacy-settings");
    });
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen} modal={!desktop}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={placement === "navigation" ? "default" : "icon"}
          className={`margin-notification-bell ${placement === "navigation" ? "margin-bottom-item" : ""}`}
          aria-label={`Notifications, ${unread} unread`}
          title="Notifications"
        >
          <Bell aria-hidden="true" strokeWidth={1.5} />
          {placement === "navigation" && <span>Notifications</span>}
          {unread > 0 && (
            <span className="margin-notification-dot" aria-hidden="true" />
          )}
        </Button>
      </DialogTrigger>
      {open && (
        <DialogContent
          className="margin-notifications-panel"
          aria-modal={!desktop || undefined}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (
              navigating.current ||
              document.querySelector("[data-profile-menu]")
            )
              event.preventDefault();
          }}
        >
          <header className="margin-notifications-header">
            <Button
              variant="ghost"
              className="margin-notifications-back"
              aria-label="Back from notifications"
              onClick={close}
            >
              <ChevronLeft aria-hidden="true" />
              Back
            </Button>
            <div className="margin-notifications-heading">
              <DialogTitle
                ref={title}
                tabIndex={-1}
                className="margin-notifications-title"
              >
                Notifications
              </DialogTitle>
              <span>{unread ? `${unread} unread` : "You’re caught up."}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="margin-notifications-settings"
              aria-label="Notification preferences"
              title="Notification preferences"
              onClick={() =>
                navigate(() =>
                  router.push("/?view=settings#notification-preferences"),
                )
              }
            >
              <Settings2 aria-hidden="true" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="margin-notifications-close"
              aria-label="Close notifications"
              title="Close notifications (Esc)"
              onClick={close}
            >
              <X aria-hidden="true" />
            </Button>
          </header>
          <DialogDescription className="sr-only">
            Sample activity in your local preview. Open an item to mark it read.
            Likes are grouped and optional.{" "}
            {desktop
              ? "Press Escape, use Close notifications, or click outside to return to the page."
              : "Use Back or your browser’s Back control to return to the page."}
          </DialogDescription>
          <div className="margin-notifications-toolbar">
            <Button
              variant="ghost"
              disabled={!unread}
              onClick={() => {
                preview.markAllNotificationsRead();
                setStatus("All visible notifications marked as read.");
              }}
            >
              Mark all as read
            </Button>
          </div>
          <div className="margin-notifications-scroll">
            <ol
              className="margin-notifications-list"
              aria-label="Recent notifications"
            >
              {preview.notificationRows.map((row) => {
                const available = notificationAvailable(
                  row,
                  preview.bootstrap.viewerId,
                  preview.state.friendships,
                  preview.now,
                  preview.state.profiles.map((profile) => profile.person.id),
                );
                const read = preview.notifications.readIds.includes(row.id);
                const TypeIcon = notificationIcons[row.kind];
                const actor = available ? row.actors[0] : undefined;
                const text = notificationText(row, available);
                const nameIndex = actor ? text.indexOf(actor.name) : -1;
                function openProfile(event: { preventDefault: () => void }) {
                  event.preventDefault();
                  if (!actor) return;
                  preview.markNotificationRead(row.id);
                  navigate(() => router.push(profileHref(actor.id)));
                }
                return (
                  <li
                    key={row.id}
                    className="margin-notification-item"
                    data-unread={!read}
                    data-kind={row.kind}
                  >
                    <div className="margin-notification-row">
                      {!available ? (
                        <span className="margin-notification-symbol">
                          <Clock3
                            size={18}
                            aria-hidden="true"
                            strokeWidth={1.5}
                          />
                        </span>
                      ) : actor ? (
                        <PersonLink
                          person={actor}
                          className="margin-notification-avatar"
                          aria-label={`View ${actor.name}’s profile`}
                          onNavigate={openProfile}
                        >
                          <Avatar person={actor} small />
                          <span className="margin-notification-type">
                            <TypeIcon
                              size={12}
                              aria-hidden="true"
                              strokeWidth={2}
                            />
                          </span>
                        </PersonLink>
                      ) : (
                        <span className="margin-notification-symbol">
                          <ShieldCheck
                            size={18}
                            aria-hidden="true"
                            strokeWidth={1.5}
                          />
                        </span>
                      )}
                      <span className="margin-notification-copy">
                        <span>
                          {!read && <span className="sr-only">Unread. </span>}
                          {actor && nameIndex >= 0 && (
                            <>
                              {text.slice(0, nameIndex)}
                              <PersonLink
                                person={actor}
                                onNavigate={openProfile}
                              >
                                {actor.name}
                              </PersonLink>{" "}
                            </>
                          )}
                          <button
                            type="button"
                            className="margin-notification-open"
                            aria-label={text}
                            onClick={() => select(row)}
                          >
                            {actor && nameIndex >= 0
                              ? text
                                  .slice(nameIndex + actor.name.length)
                                  .trimStart()
                              : text}
                          </button>
                        </span>
                        <time dateTime={row.createdAt}>
                          {relativeTime(
                            row.createdAt,
                            new Date(preview.now).toISOString(),
                          )}
                        </time>
                      </span>
                      <ChevronRight
                        size={16}
                        className="margin-notification-chevron"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    </div>
                    {row.kind === "friend_request" &&
                      available &&
                      row.actors[0] && (
                        <div className="margin-notification-friend-actions">
                          <FriendActions
                            person={
                              preview.state.profiles.find(
                                (profile) =>
                                  row.target.kind === "profile" &&
                                  profile.person.id === row.target.personId,
                              )!.person
                            }
                            onComplete={(message) => {
                              preview.markNotificationRead(row.id);
                              setStatus(message);
                              title.current?.focus({ preventScroll: true });
                            }}
                          />
                        </div>
                      )}
                  </li>
                );
              })}
            </ol>
            {!preview.notificationRows.length && (
              <p className="margin-notifications-empty">
                Nothing here right now. You’re all caught up.
              </p>
            )}
          </div>
          <footer className="margin-notifications-footer">
            <span>Sample activity</span>
            <p role="status" aria-live="polite">
              {status}
            </p>
          </footer>
        </DialogContent>
      )}
    </Dialog>
  );
}
