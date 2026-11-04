"use client";
import { useId } from "react";

export function PostPhotoDeleteOption({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="margin-post-photo-delete-option">
      <label>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={id}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Also delete attached photographs</span>
      </label>
      <p id={id} className="margin-field-hint">
        Removes these photos from Gallery, your profile and other posts. Today’s
        upload count stays the same.
      </p>
    </div>
  );
}
