"use client";
import type { Preferences } from "@/features/local-preview/model";
import { SettingSaveStatus, type SettingFeedback } from "./setting-save-status";
export function ReadingSettings({
  preferences,
  onChange,
  disabled = false,
  feedback,
}: {
  preferences: Preferences;
  onChange: (value: Partial<Preferences>) => void;
  disabled?: boolean;
  feedback?: SettingFeedback;
}) {
  return (
    <>
      <fieldset disabled={disabled}>
        <legend>
          Text size{" "}
          <SettingSaveStatus setting="readingSize" feedback={feedback} />
        </legend>
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
                onChange={() => onChange({ readingSize: option.value })}
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
      <fieldset disabled={disabled}>
        <legend>
          Motion <SettingSaveStatus setting="motion" feedback={feedback} />
        </legend>
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
                onChange={() => onChange({ motion: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p id="motion-help" className="margin-field-hint">
          System follows your device’s reduced-motion preference.
        </p>
      </fieldset>
    </>
  );
}
