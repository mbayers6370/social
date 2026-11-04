"use client";
import { useEffect, useRef, useState } from "react";

/** Device previews stay in this tab; each URL lives as long as its selected file. */
export function DevicePhotoPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState<File>();
  useEffect(() => {
    const src = URL.createObjectURL(file);
    if (image.current) image.current.src = src;
    return () => URL.revokeObjectURL(src);
  }, [file]);
  return (
    <>
      {/* Tab-local blobs cannot use the server image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
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
