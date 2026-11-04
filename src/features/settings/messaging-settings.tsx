"use client";
import {
  MESSAGE_LIFETIME_DAYS,
  NOTEBOOK_LIFETIME_DAYS,
} from "@/lib/message-policy";
import { SettingSaveStatus, type SettingFeedback } from "./setting-save-status";

export function MessagingSettings({
  enabled,
  disabled,
  onChange,
  feedback,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  feedback?: SettingFeedback;
}) {
  return (
    <section
      className="margin-settings-section"
      id="messaging-settings"
      aria-labelledby="messaging-settings-title"
    >
      <h2 id="messaging-settings-title">Messaging</h2>
      <p className="margin-settings-sharing">
        Messaging is on by default. Turn it off if you prefer to catch up
        through posts and Spaces.
      </p>
      <p className="margin-settings-sharing">
        Messages are deleted after {MESSAGE_LIFETIME_DAYS} days. You can export
        any conversation. Notebook is your private space for notes to yourself;
        notes are deleted after {NOTEBOOK_LIFETIME_DAYS} days.
      </p>
      <div className="margin-setting-with-feedback">
        <label className="margin-notification-preference">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby="messaging-setting-detail"
          />
          <span>
            <strong>Allow messaging</strong>
            <span>Send and receive private messages with friends</span>
          </span>
        </label>
        <SettingSaveStatus setting="messagingEnabled" feedback={feedback} />
      </div>
      <p className="margin-field-hint" id="messaging-setting-detail">
        {enabled
          ? "Turning this off hides Messages and your profile’s Message button, and stops sending and receiving."
          : "Messaging is off. Messages and your profile’s Message button are hidden, and nobody can message you."}{" "}
        Turn it back on to restore access to your available conversations and
        Notebook.
      </p>
    </section>
  );
}
