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
      <h3 id="notification-preferences-title" className="sr-only">
        Notifications
      </h3>
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
        These choices change activity in this tab. Push and email delivery
        aren’t connected.
      </p>
    </section>
  );
}
