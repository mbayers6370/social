"use client";
import { publicDemo } from "@/lib/public-demo";
import Link from "@/components/shared/preview-link";
import { useEffect } from "react";
import {
  ChevronRight,
  Settings as SettingsIcon,
} from "@/components/margin-icons";
import { SectionTitle, SectionMotif } from "@/components/shared/section-motif";
import { PreviewDataControls } from "./preview-data-controls";
import { ReadingSettings } from "./reading-settings";
import { UsernameSettings } from "./username-settings";
import { NotificationPreferences } from "@/features/notifications/notification-preferences";
import { AppFooter } from "@/components/layout/app-footer";
import { usePreview } from "@/features/local-preview/provider";
import { SafetySettings } from "@/features/safety/safety-settings";
import { AccountControls } from "@/features/account/account-controls";
import { Avatar } from "@/features/feed/post-content";
import { useSettingFeedback } from "./setting-save-status";

export function SettingsPage() {
  const [feedback, setFeedback] = useSettingFeedback();
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
        <SectionTitle
          as="h1"
          id="settings-title"
          motif={<SectionMotif icon={SettingsIcon} />}
        >
          Settings
        </SectionTitle>
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
            <ReadingSettings
              preferences={preferences}
              feedback={feedback}
              onChange={(patch) => {
                updatePreferences(patch);
                setFeedback({ key: Object.keys(patch)[0], state: "saved" });
              }}
            />
          </section>
          <section
            className="margin-settings-section"
            id="activity-settings"
            aria-labelledby="activity-title"
          >
            <h2 id="activity-title">Notifications</h2>
            <NotificationPreferences />
          </section>
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
                <ChevronRight aria-hidden="true" />
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
              {publicDemo
                ? "Demo changes stay in this browser tab."
                : "Your posts and photographs are shared with accepted friends."}
            </p>
            <SafetySettings />
            <Link
              href={publicDemo ? "/your-data/" : "/privacy"}
              className="margin-settings-inline-link"
            >
              {publicDemo ? "How demo data works" : "How sharing works"}
              <ChevronRight aria-hidden="true" />
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
