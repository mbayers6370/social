"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Close } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { relativeTime } from "@/features/feed/format";
import { NotificationBellIcon } from "@/features/notifications/notification-bell-icon";
import { useSpaceClient } from "@/features/spaces/client";
import { requestMember, memberJson } from "./member-client";
import { useMember } from "./member-provider";
import { MemberFriendActions } from "./member-friend-actions";
import { SpaceInvitationAction } from "@/features/spaces/space-invitation-action";
import type { MemberActivity } from "./member-contracts";
type ActivityPage = { activity: MemberActivity[]; nextCursor: string | null };
const descriptions = {
  friend_request: "sent you a friend request",
  friend_accepted: "accepted your friend request",
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  message: "sent you a message",
  space_post: "posted in a Space",
  space_invitation: "invited you to a Space",
};

export function MemberNotifications() {
  const client = useSpaceClient();
  const router = useRouter();
  const member = useMember();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ActivityPage>({
    activity: [],
    nextCursor: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const enabled = member !== null;
  const [referenceTime] = useState(() => new Date().toISOString());
  const messagingEnabled =
    member?.identity.preferences.messagingEnabled === true;
  const visibleActivity = useMemo(
    () =>
      data.activity.filter((row) => row.kind !== "message" || messagingEnabled),
    [data.activity, messagingEnabled],
  );
  const unread = useMemo(
    () => visibleActivity.filter((row) => !row.read).map((row) => row.id),
    [visibleActivity],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await requestMember<ActivityPage>(
        client,
        "/api/notifications",
        { signal },
      );
      if (!signal?.aborted) {
        setData(next);
        setError("");
      }
    },
    [client],
  );
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let busy = false;
    const poll = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        await refresh(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Activity could not be loaded.",
          );
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 30000);
    window.addEventListener("margin:member-updated", poll);
    window.addEventListener("focus", poll);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("margin:member-updated", poll);
      window.removeEventListener("focus", poll);
    };
  }, [enabled, refresh]);
  async function mark(id?: string) {
    await requestMember(
      client,
      "/api/notifications",
      memberJson("PUT", id ? { id } : {}),
    );
    setData((current) => ({
      ...current,
      activity: current.activity.map((row) =>
        !id || row.id === id ? { ...row, read: true } : row,
      ),
    }));
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setLoading(true);
          void refresh()
            .catch((error) => setError(error.message))
            .finally(() => setLoading(false));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="margin-notification-bell"
          aria-label={
            unread.length
              ? `Notifications, ${unread.length} unread`
              : "Notifications"
          }
          title="Notifications"
        >
          <NotificationBellIcon
            unreadIds={unread}
            paused={open || member?.identity.preferences.motion === "reduced"}
            seenIds={member?.notificationSeen}
          />
          {unread.length > 0 && <span className="margin-notification-dot" />}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="margin-notifications-panel"
        showCloseButton={false}
      >
        <header className="margin-notifications-header">
          <Button
            className="margin-notifications-back"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            <ChevronLeft aria-hidden="true" />
            Back
          </Button>
          <div className="margin-notifications-heading">
            <DialogTitle className="margin-notifications-title">
              Notifications
            </DialogTitle>
            <DialogDescription
              className={
                visibleActivity.length
                  ? "margin-notifications-description"
                  : "sr-only"
              }
            >
              {unread.length
                ? `${unread.length} unread`
                : visibleActivity.length
                  ? "All read"
                  : "Your latest activity."}
            </DialogDescription>
          </div>
          <Button
            className="margin-notifications-close"
            variant="ghost"
            size="icon"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          >
            <Close aria-hidden="true" />
          </Button>
        </header>
        {visibleActivity.length > 0 && (
          <div className="margin-notifications-toolbar">
            <Button
              variant="ghost"
              disabled={working || !unread.length}
              onClick={async () => {
                setWorking(true);
                try {
                  await mark();
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t mark activity read.",
                  );
                } finally {
                  setWorking(false);
                }
              }}
            >
              Mark all as read
            </Button>
          </div>
        )}
        <div className="margin-notifications-scroll">
          {loading && <p role="status">Loading activity…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() =>
                  void refresh().catch((error) => setError(error.message))
                }
              >
                Try again
              </Button>
            </div>
          )}
          {!loading && !error && !visibleActivity.length && (
            <div className="margin-notifications-empty">
              <h3>You’re all caught up</h3>
              <p>New activity will appear here.</p>
            </div>
          )}
          <ul className="margin-notifications-list">
            {visibleActivity.map((row) => (
              <li
                key={row.id}
                className="margin-notification-item"
                data-unread={!row.read}
                data-kind={row.kind}
              >
                <button
                  type="button"
                  className="margin-notification-row"
                  disabled={working}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      await mark(row.id);
                      setOpen(false);
                      router.push(row.href);
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Couldn’t open this activity.",
                      );
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  <span className="margin-notification-avatar">
                    <Avatar live person={row.actor} />
                  </span>
                  <span className="margin-notification-copy">
                    <span>
                      <strong>{row.actor.name}</strong>{" "}
                      {row.kind === "space_invitation" && row.invitation
                        ? `invited you to ${row.invitation.space.name}`
                        : row.kind === "space_post" && row.spaceName
                          ? `posted in ${row.spaceName}`
                          : descriptions[row.kind]}
                      .
                    </span>
                    <time dateTime={row.createdAt}>
                      {relativeTime(row.createdAt, referenceTime)}
                    </time>
                  </span>
                  <ChevronRight
                    className="margin-notification-chevron"
                    aria-hidden="true"
                  />
                </button>
                {row.kind === "friend_request" && (
                  <div className="margin-notification-friend-actions">
                    <MemberFriendActions
                      person={row.actor}
                      relationship="incoming"
                    />
                  </div>
                )}
                {row.kind === "space_invitation" && row.invitation && (
                  <div className="margin-notification-invitation-actions">
                    <SpaceInvitationAction
                      invitation={row.invitation}
                      onJoined={() => {
                        setData((current) => ({
                          ...current,
                          activity: current.activity.filter(
                            (activity) => activity.id !== row.id,
                          ),
                        }));
                        setOpen(false);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {data.nextCursor && (
            <Button
              variant="ghost"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const older = await requestMember<ActivityPage>(
                    client,
                    `/api/notifications?before=${encodeURIComponent(data.nextCursor!)}`,
                  );
                  setData((current) => ({
                    ...older,
                    activity: [...current.activity, ...older.activity],
                  }));
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t load older activity.",
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              Older activity
            </Button>
          )}
        </div>
        <footer className="margin-notifications-footer">
          <Link
            href="/app/settings#activity-settings"
            onClick={() => setOpen(false)}
          >
            Notification settings
          </Link>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
