"use client";
import { usePreview } from "@/features/local-preview/provider";
export function NotificationPreferences() {
  const { notifications, updateNotificationPreferences } = usePreview();
  return (
    <section
      id="notification-preferences"
      className="margin-notification-preferences"
      aria-labelledby="notification-preferences-title"
    >
      <h2 id="notification-preferences-title">Notifications</h2>
      <p className="margin-field-hint">
        Choose the sample activity shown in your notification center.
        Preferences apply to this tab and reset on refresh.
      </p>
      {(
        [
          [
            "replies",
            "Comments & replies",
            "Activity on your posts and replies to you",
          ],
          [
            "friendships",
            "Friendship updates",
            "Friend requests and accepted connections",
          ],
          ["likes", "Likes", "Grouped together for each post"],
        ] as const
      ).map(([key, label, description]) => (
        <label key={key} className="margin-notification-preference">
          <input
            type="checkbox"
            checked={notifications.preferences[key]}
            onChange={(event) =>
              updateNotificationPreferences({ [key]: event.target.checked })
            }
          />
          <span>
            <strong>{label}</strong>
            <span>{description}</span>
          </span>
        </label>
      ))}
      <p className="margin-field-hint">
        Account information remains available. Push notifications and email
        delivery aren’t connected.
      </p>
    </section>
  );
}
