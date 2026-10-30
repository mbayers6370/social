"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PreviewDataControls } from "./preview-data-controls";
import { UsernameSettings } from "./username-settings";
import { NotificationPreferences } from "@/features/notifications/notification-preferences";
import { AppFooter } from "@/components/layout/app-footer";
import { usePreview } from "@/features/local-preview/provider";
import { SafetySettings } from "@/features/safety/safety-settings";
import { AccountControls } from "@/features/account/account-controls";
import { Avatar } from "@/features/feed/post-content";

export function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    state,
    bootstrap,
    requestProfileEdit,
  } = usePreview();
  const profile = state.profiles.find(
    (profile) => profile.person.id === bootstrap.viewerId,
  )!;
  useEffect(() => {
    const reveal = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      const disclosure = target?.closest("details");
      if (disclosure) disclosure.open = true;
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return (
    <section className="margin-settings-page" aria-labelledby="settings-title">
      <header className="margin-settings-opening">
        <Link href="/?view=profile" className="margin-back-link">
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
          Profile
        </Link>
        <h1 id="settings-title">Settings</h1>
        <p>Reading, notifications and your account.</p>
      </header>
      <div className="margin-settings-columns">
        <div className="margin-settings-column">
          <section
            className="margin-settings-section"
            id="reading-settings"
            aria-labelledby="reading-title"
          >
            <h2 id="reading-title">Reading & motion</h2>
            <fieldset>
              <legend>Text size</legend>
              <div className="margin-setting-segments">
                {(
                  [
                    { value: "standard", label: "Standard" },
                    { value: "larger", label: "Larger" },
                    { value: "extra-large", label: "Extra large" },
                  ] as const
                ).map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="reading-size"
                      value={option.value}
                      checked={preferences.readingSize === option.value}
                      onChange={() =>
                        updatePreferences({ readingSize: option.value })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div
                className="margin-text-size-preview"
                role="group"
                aria-label="Text size preview"
              >
                <p>A little room to read comfortably.</p>
                <span>This is how your text will look.</span>
              </div>
            </fieldset>
            <fieldset>
              <legend>Motion</legend>
              <div className="margin-setting-segments">
                {(
                  [
                    { value: "system", label: "Follow system" },
                    { value: "reduced", label: "Reduce motion" },
                  ] as const
                ).map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="motion"
                      value={option.value}
                      checked={preferences.motion === option.value}
                      aria-describedby="motion-help"
                      onChange={() =>
                        updatePreferences({ motion: option.value })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p id="motion-help" className="margin-field-hint">
                System follows your device’s reduced-motion preference.
              </p>
            </fieldset>
          </section>
          <section
            className="margin-settings-section"
            id="activity-settings"
            aria-labelledby="activity-title"
          >
            <h2 id="activity-title">Notifications</h2>
            <NotificationPreferences />
          </section>
          <p className="margin-settings-help">
            Something you’re looking for?
            <Link href="/help">
              Help & safety
              <ChevronRight aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </p>
        </div>
        <div className="margin-settings-column">
          <section
            className="margin-settings-section"
            id="profile-settings"
            aria-labelledby="profile-settings-title"
          >
            <h2 id="profile-settings-title">Profile</h2>
            <Link
              href="/?view=profile"
              className="margin-settings-profile"
              onNavigate={requestProfileEdit}
            >
              <Avatar person={profile.person} sizes="48px" />
              <span>
                <strong>{profile.person.name}</strong>
                <span>Name, bio and photograph</span>
              </span>
              <span>
                Edit profile
                <ChevronRight aria-hidden="true" strokeWidth={1.5} />
              </span>
            </Link>
            <UsernameSettings />
          </section>
          <section
            className="margin-settings-section"
            id="privacy-settings"
            aria-labelledby="privacy-settings-title"
          >
            <h2 id="privacy-settings-title">Privacy & safety</h2>
            <p className="margin-settings-sharing">
              Your posts and photographs are shared with accepted friends.
            </p>
            <SafetySettings />
            <Link href="/privacy" className="margin-settings-inline-link">
              How sharing works
              <ChevronRight aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </section>
          <section
            className="margin-settings-section"
            id="data-settings"
            aria-labelledby="data-settings-title"
          >
            <h2 id="data-settings-title">Account & data</h2>
            <AccountControls />
            <PreviewDataControls />
          </section>
        </div>
      </div>
      <p className="margin-settings-preview-note">
        This is your local preview. Preferences and account changes stay in this
        tab and reset on refresh.
      </p>
      <AppFooter />
    </section>
  );
}
