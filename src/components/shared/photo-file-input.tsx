"use client";

import { useId, type ComponentProps } from "react";
import { Image as ImageIcon, Upload } from "@/components/margin-icons";
import { publicDemo } from "@/lib/public-demo";
import { PHOTO_ACCEPT } from "@/lib/media-policy";

type Props = Omit<ComponentProps<"input">, "type" | "accept"> & {
  file?: File;
};

/** One native file input keeps browser, keyboard and touch selection intact. */
export function PhotoFileInput({ file, disabled, ...props }: Props) {
  const hintId = useId();
  disabled = disabled || publicDemo;
  return (
    <div className="margin-file-picker" data-disabled={disabled || undefined}>
      <span className="margin-file-picker-mark" aria-hidden="true">
        <ImageIcon />
      </span>
      <div className="margin-file-summary">
        <span className="margin-file-name" role="status">
          {file?.name ?? "Upload from your device"}
        </span>
        <span id={hintId} className="margin-field-hint">
          {publicDemo
            ? "Demo · Choose a bundled photograph from your library"
            : "JPEG, PNG or WebP · Up to 8 MB"}
        </span>
      </div>
      <span className="margin-upload-choose" aria-hidden="true">
        <Upload />
        {file ? "Change photograph" : "Choose photograph"}
      </span>
      <input
        {...props}
        className="margin-upload-native"
        type="file"
        accept={PHOTO_ACCEPT}
        aria-describedby={[hintId, props["aria-describedby"]]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled}
      />
    </div>
  );
}
