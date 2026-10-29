"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PreviewDataControls } from "./preview-data-controls";
import { MINIMUM_AGE } from "@/lib/platform-rules";
import { NotificationPreferences } from "@/features/notifications/notification-preferences";
import { AppFooter } from "@/components/layout/app-footer";
import { usePreview } from "@/features/local-preview/provider";

export function SettingsPage() {
  const { preferences, updatePreferences } = usePreview();
  return (
    <section className="margin-settings-page" aria-labelledby="settings-title">
      <header>
        <Link href="/?view=profile" className="margin-back-link">
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
          Profile
        </Link>
        <h1 id="settings-title">Settings</h1>
        <p className="margin-field-hint">
          Reading preferences apply across this tab and reset on refresh.
        </p>
      </header>
      <div className="margin-settings-columns">
        <section aria-labelledby="reading-settings">
          <h2 id="reading-settings">Reading & motion</h2>
          <fieldset>
            <legend>Text size</legend>
            <p id="reading-help" className="margin-field-hint">
              Adjust all text, including buttons, labels and dialogs. Browser
              zoom still works alongside this setting.
            </p>
            {(
              [
                { value: "standard", label: "Standard" },
                { value: "larger", label: "Larger" },
                { value: "extra-large", label: "Extra large" },
              ] as const
            ).map((option) => (
              <label className="margin-setting-choice" key={option.value}>
                <input
                  type="radio"
                  name="reading-size"
                  value={option.value}
                  checked={preferences.readingSize === option.value}
                  aria-describedby="reading-help"
                  onChange={() =>
                    updatePreferences({ readingSize: option.value })
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
            <div
              className="margin-text-size-preview"
              role="group"
              aria-label="Text size preview"
            >
              <p>A little room to read comfortably.</p>
              <span>Posts, messages and everyday details.</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Motion</legend>
            <p id="motion-help" className="margin-field-hint">
              System follows your device’s reduced-motion preference.
            </p>
            {(
              [
                { value: "system", label: "Follow system" },
                { value: "reduced", label: "Reduce motion" },
              ] as const
            ).map((option) => (
              <label className="margin-setting-choice" key={option.value}>
                <input
                  type="radio"
                  name="motion"
                  value={option.value}
                  checked={preferences.motion === option.value}
                  aria-describedby="motion-help"
                  onChange={() => updatePreferences({ motion: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <NotificationPreferences />
        </section>
        <section aria-labelledby="privacy-settings">
          <h2 id="privacy-settings">Privacy & account</h2>
          <div className="margin-settings-groups">
            <Link href="/?view=profile" className="margin-setting-link">
              <span>
                <strong>Profile</strong>
                <span>Name, bio and your photographs</span>
              </span>
              <ChevronRight aria-hidden="true" strokeWidth={1.5} />
            </Link>
            <div className="margin-setting-summary">
              <h3>Sharing</h3>
              <p>
                Posts are for friends. Profiles can be found by name or
                username.
              </p>
              <p className="margin-field-hint">
                This local preview uses sample friendships. Live account privacy
                is not connected yet.
              </p>
            </div>
            <div className="margin-setting-summary">
              <h3>Photographs only</h3>
              <p>
                Still JPEG, PNG and WebP images. Video, animated images and
                video embeds aren’t supported.
              </p>
            </div>
            <div className="margin-setting-summary">
              <h3>Sign-in & security</h3>
              <p className="margin-field-hint">
                Passkeys, MFA and sessions will be managed through the connected
                authentication service. Account controls aren’t available in
                this local preview.
              </p>
            </div>
            <PreviewDataControls />
            <div className="margin-setting-summary">
              <h3>Help & about margin</h3>
              <p className="margin-field-hint">
                The initial minimum signup age is {MINIMUM_AGE}. Registration
                and real account controls are not open yet.
              </p>
              <nav
                className="margin-settings-links"
                aria-label="Help and about margin"
              >
                {[
                  ["Public website", "/welcome"],
                  ["Your data explained", "/your-data"],
                  ["Contact", "/contact"],
                ].map(([label, href]) => (
                  <Link className="margin-setting-link" key={href} href={href}>
                    {label}
                    <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                  </Link>
                ))}
              </nav>
              <AppFooter />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
