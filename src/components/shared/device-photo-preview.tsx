"use client";
import { useCallback, useState } from "react";

/** Device previews stay in this tab; each URL lives as long as its selected file. */
export function DevicePhotoPreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; src: string }>();
  const [failed, setFailed] = useState<File>();
  const attachPreview = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node) return;
      // Acquire the browser resource only when the image mounts. Accept only a
      // tab-local blob URL without HTML metacharacters before rendering it.
      const src = URL.createObjectURL(file);
      if (!src.startsWith("blob:") || /["'&<>]/.test(src)) {
        URL.revokeObjectURL(src);
        setFailed(file);
        return;
      }
      setPreview({ file, src });
      return () => URL.revokeObjectURL(src);
    },
    [file],
  );
  return (
    <>
      {/* Tab-local blobs cannot use the server image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={attachPreview}
        src={preview?.file === file ? preview.src : undefined}
        className="margin-dropped-photo"
        alt="Selected photograph"
        width={320}
        height={240}
        loading="eager"
        hidden={failed === file}
        onLoad={() => setFailed(undefined)}
        onError={() => setFailed(file)}
      />
      {failed === file && (
        <p role="alert">
          This photograph couldn’t be previewed. Choose another JPEG, PNG or
          WebP image.
        </p>
      )}
    </>
  );
}
