"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "@/components/margin-icons";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { Avatar } from "@/features/feed/post-content";
import { ReadingSettings } from "@/features/settings/reading-settings";
import { MessagingSettings } from "@/features/settings/messaging-settings";
import { UsernameSettings } from "@/features/settings/username-settings";
import { AccountControls } from "@/features/account/account-controls";
import { Button } from "@/components/ui/button";
import { AppFooter } from "@/components/layout/app-footer";
import { useSpaceClient } from "@/features/spaces/client";
import { useMember } from "./member-provider";
import { memberJson, requestMember, memberChanged } from "./member-client";
import { MemberDataControls } from "./member-data-controls";
import type { MemberIdentity, MemberPreferences } from "./member-contracts";
export type MemberSafety = {
  blocked: { id: string; name: string }[];
  reports: {
    id: string;
    reason: string;
    status: string;
    targetKind: string;
    createdAt: string;
  }[];
};

export function MemberSettings({
  initial,
  safety,
}: {
  initial: MemberIdentity;
  safety: MemberSafety;
}) {
  const client = useSpaceClient();
  const member = useMember();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const identity = member?.identity ?? saved;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const reveal = () =>
      document
        .getElementById(window.location.hash.slice(1))
        ?.closest("details")
        ?.setAttribute("open", "");
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  async function updatePreferences(patch: Partial<MemberPreferences>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const next = await requestMember<MemberIdentity>(
        client,
        "/api/member/preferences",
        memberJson("PATCH", patch),
      );
      setSaved(next);
      member?.acceptIdentity(next);
      memberChanged();
      setStatus("Settings saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <LiveAppShell active="profile">
      <section
        className="margin-settings-page"
        aria-labelledby="settings-title"
      >
        <header className="margin-settings-opening">
          <Link href="/app" className="margin-back-link">
            <ChevronLeft aria-hidden="true" />
            Profile
          </Link>
          <h1 id="settings-title">Settings</h1>
          <p>Reading, messaging, notifications and your account.</p>
        </header>
        {error && (
          <p role="alert" className="margin-settings-feedback">
            {error}
          </p>
        )}
        <p role="status" className="margin-settings-feedback">
          {busy ? "Saving your settings…" : status}
        </p>
        <div className="margin-settings-columns">
          <div className="margin-settings-column">
            <section
              className="margin-settings-section"
              id="reading-settings"
              aria-labelledby="reading-title"
            >
              <h2 id="reading-title">Reading &amp; motion</h2>
              <ReadingSettings
                preferences={identity.preferences}
                disabled={busy}
                onChange={(patch) => void updatePreferences(patch)}
              />
            </section>
            <MessagingSettings
              enabled={identity.preferences.messagingEnabled}
              disabled={busy}
              onChange={(messagingEnabled) =>
                void updatePreferences({ messagingEnabled })
              }
            />
            <section
              className="margin-settings-section"
              id="activity-settings"
              aria-labelledby="activity-title"
            >
              <h2 id="activity-title">Notifications</h2>
              <section
                id="notification-preferences"
                className="margin-notification-preferences"
                aria-label="Notification preferences"
              >
                {(
                  [
                    [
                      "notifyComments",
                      "Comments & replies",
                      "Activity on your posts and replies to you",
                    ],
                    [
                      "notifyFriends",
                      "Friendship updates",
                      "Friend requests and accepted connections",
                    ],
                    ["notifyLikes", "Likes", "Activity on your posts"],
                    [
                      "notifyMessages",
                      "Messages",
                      "New private messages from your conversations",
                    ],
                  ] as const
                ).map(([key, label, description]) => (
                  <label className="margin-notification-preference" key={key}>
                    <input
                      type="checkbox"
                      checked={identity.preferences[key]}
                      disabled={
                        busy ||
                        (key === "notifyMessages" &&
                          !identity.preferences.messagingEnabled)
                      }
                      onChange={(event) =>
                        void updatePreferences({ [key]: event.target.checked })
                      }
                    />
                    <span>
                      <strong>{label}</strong>
                      <span>{description}</span>
                    </span>
                  </label>
                ))}
                <p className="margin-field-hint">
                  These choices control your in-app activity. Push notifications
                  and notification emails are not enabled.
                </p>
              </section>
            </section>
          </div>
          <div className="margin-settings-column">
            <section
              className="margin-settings-section"
              id="profile-settings"
              aria-labelledby="profile-settings-title"
            >
              <h2 id="profile-settings-title">Profile</h2>
              <Link href="/app?edit=1" className="margin-settings-profile">
                <Avatar live person={identity.person} sizes="48px" />
                <span>
                  <strong>{identity.person.name}</strong>
                  <span>Name, bio and photograph</span>
                </span>
                <span>
                  Edit profile
                  <ChevronRight aria-hidden="true" />
                </span>
              </Link>
              <UsernameSettings
                account={{
                  id: identity.person.id,
                  username: identity.username,
                  usernameChangedAt: identity.usernameChangedAt,
                  onChange: async (username) => {
                    const next = await requestMember<MemberIdentity>(
                      client,
                      "/api/member/username",
                      memberJson("PUT", { username }),
                    );
                    setSaved(next);
                    member?.acceptIdentity(next);
                    memberChanged();
                    router.refresh();
                  },
                }}
              />
            </section>
            <section
              className="margin-settings-section"
              id="privacy-settings"
              aria-labelledby="privacy-settings-title"
            >
              <h2 id="privacy-settings-title">Privacy &amp; safety</h2>
              <p className="margin-settings-sharing">
                Your posts and photographs are shared with accepted friends.
                Space content follows that Space’s membership.
              </p>
              <div id="safety-settings" className="margin-settings-safety">
                <details className="margin-settings-record">
                  <summary>
                    <span>Blocked people</span>
                    <span>{safety.blocked.length}</span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div>
                    <p className="margin-field-hint">
                      Blocking prevents new requests and messages. Unblocking
                      does not restore the friendship.
                    </p>
                    {safety.blocked.length ? (
                      <ul className="margin-blocked-people">
                        {safety.blocked.map((person) => (
                          <li key={person.id}>
                            <span>{person.name}</span>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                setError("");
                                try {
                                  await requestMember(
                                    client,
                                    "/api/relationships",
                                    memberJson("POST", {
                                      targetId: person.id,
                                      action: "unblock",
                                    }),
                                  );
                                  memberChanged();
                                  router.refresh();
                                  setStatus(`${person.name} unblocked.`);
                                } catch (error) {
                                  setError(
                                    error instanceof Error
                                      ? error.message
                                      : "Couldn’t unblock this member.",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Unblock
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No blocked people.</p>
                    )}
                  </div>
                </details>
                <details className="margin-settings-record">
                  <summary>
                    <span>Your reports</span>
                    <span>{safety.reports.length}</span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div>
                    <p className="margin-field-hint">
                      These reports are saved to your account. Contact
                      support@margin.social if you need help.
                    </p>
                    {safety.reports.length ? (
                      <ul className="margin-saved-reports">
                        {safety.reports.map((report) => (
                          <li key={report.id}>
                            <strong>
                              {report.targetKind === "message"
                                ? "Conversation"
                                : report.targetKind === "post"
                                  ? "Post"
                                  : "Profile"}
                            </strong>
                            <span>{report.reason.replaceAll("_", " ")}</span>
                            <span className="margin-field-hint">
                              {report.status} ·{" "}
                              {new Date(report.createdAt).toLocaleDateString(
                                "en-US",
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No reports saved.</p>
                    )}
                  </div>
                </details>
              </div>
              <Link href="/privacy" className="margin-settings-inline-link">
                How sharing works
                <ChevronRight aria-hidden="true" />
              </Link>
            </section>
            <section
              className="margin-settings-section"
              id="data-settings"
              aria-labelledby="data-settings-title"
            >
              <h2 id="data-settings-title">Account &amp; data</h2>
              <AccountControls />
              <MemberDataControls />
            </section>
          </div>
        </div>
        <AppFooter />
      </section>
    </LiveAppShell>
  );
}
