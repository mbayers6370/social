"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Settings as SettingsIcon,
} from "@/components/margin-icons";
import { SectionTitle, SectionMotif } from "@/components/shared/section-motif";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { Avatar } from "@/features/feed/post-content";
import { ReadingSettings } from "@/features/settings/reading-settings";
import { MessagingSettings } from "@/features/settings/messaging-settings";
import { UsernameSettings } from "@/features/settings/username-settings";
import {
  SettingSaveStatus,
  useSettingFeedback,
} from "@/features/settings/setting-save-status";
import { AccountControls } from "@/features/account/account-controls";
import { Button } from "@/components/ui/button";
import { AppFooter } from "@/components/layout/app-footer";
import { useSpaceClient } from "@/features/spaces/client";
import { useMember } from "./member-provider";
import {
  memberJson,
  requestMember,
  requestMemberIdentity,
  memberChanged,
} from "./member-client";
import { MemberDataControls } from "./member-data-controls";
import type { MemberIdentity, MemberPreferences } from "./member-contracts";
import { TimeZonePicker } from "@/features/spaces/time-zone-picker";
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
  const [postingZone, setPostingZone] = useState(
    initial.preferences.postingTimeZone ?? "America/Los_Angeles",
  );
  const identity = member?.identity ?? saved;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [feedback, setFeedback] = useSettingFeedback();
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
    const key = Object.keys(patch)[0];
    setFeedback({ key, state: "saving" });
    try {
      const next = await requestMemberIdentity(
        client,
        "/api/member/preferences",
        memberJson("PATCH", patch),
      );
      setSaved(next);
      member?.acceptIdentity(next);
      memberChanged();
      setFeedback({ key, state: "saved" });
    } catch (error) {
      setFeedback(null);
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
          <SectionTitle
            as="h1"
            id="settings-title"
            motif={<SectionMotif icon={SettingsIcon} />}
          >
            Settings
          </SectionTitle>
          <p>Reading, messaging, notifications and your account.</p>
          {identity.founder && (
            <Link href="/app/moderation">Review safety reports</Link>
          )}
        </header>
        {error && (
          <p role="alert" className="margin-settings-feedback">
            {error}
          </p>
        )}
        <p role="status" className="margin-settings-feedback">
          {status}
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
                feedback={feedback}
                disabled={busy}
                onChange={(patch) => void updatePreferences(patch)}
              />
            </section>
            <MessagingSettings
              feedback={feedback}
              enabled={identity.preferences.messagingEnabled}
              disabled={busy}
              onChange={(messagingEnabled) =>
                void updatePreferences({ messagingEnabled })
              }
            />
            <section
              className="margin-settings-section"
              aria-labelledby="posting-zone-title"
            >
              <h2 id="posting-zone-title">Posting day</h2>
              <p className="margin-settings-sharing">
                Your posting day follows{" "}
                {identity.preferences.postingTimeZone
                  ?.replaceAll("_", " ")
                  .replaceAll("/", " / ") ?? "America / Los Angeles"}
                .
              </p>
              <details className="margin-settings-record">
                <summary>
                  <span>Change time zone</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div>
                  <p className="margin-field-hint">
                    Daily post and photo limits use your saved time zone.
                    Changing it carries recent usage forward for at least 24
                    hours; deleting content does not restore an allowance.
                  </p>
                  <form
                    className="margin-settings-posting-zone"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void updatePreferences({ postingTimeZone: postingZone });
                    }}
                  >
                    <label htmlFor="posting-time-zone">Time zone</label>
                    <TimeZonePicker
                      id="posting-time-zone"
                      value={postingZone}
                      onChange={setPostingZone}
                    />
                    <div className="margin-form-actions">
                      <Button type="submit" variant="outline" disabled={busy}>
                        Save time zone
                      </Button>
                      <SettingSaveStatus
                        feedback={feedback}
                        setting="postingTimeZone"
                      />
                    </div>
                  </form>
                </div>
              </details>
            </section>
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
                  <div className="margin-setting-with-feedback" key={key}>
                    <label className="margin-notification-preference">
                      <input
                        type="checkbox"
                        checked={identity.preferences[key]}
                        disabled={
                          busy ||
                          (key === "notifyMessages" &&
                            !identity.preferences.messagingEnabled)
                        }
                        onChange={(event) =>
                          void updatePreferences({
                            [key]: event.target.checked,
                          })
                        }
                      />
                      <span>
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </span>
                    </label>
                    <SettingSaveStatus setting={key} feedback={feedback} />
                  </div>
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
              <label className="margin-notification-preference">
                <input
                  type="checkbox"
                  checked={identity.preferences.showTopFriends !== false}
                  disabled={busy}
                  onChange={(event) =>
                    void updatePreferences({
                      showTopFriends: event.target.checked,
                    })
                  }
                />
                <span>
                  <strong>Show Top 4 on your profile</strong>
                  <span>
                    Visible to you and your accepted friends. Hiding it keeps
                    your selections.
                  </span>
                </span>
              </label>
              <SettingSaveStatus setting="showTopFriends" feedback={feedback} />
              <UsernameSettings
                account={{
                  id: identity.person.id,
                  username: identity.username,
                  usernameChangedAt: identity.usernameChangedAt,
                  onChange: async (username) => {
                    const next = await requestMemberIdentity(
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
                    <span>{safety.blocked.length || "None"}</span>
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
                    <span>{safety.reports.length || "None"}</span>
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
