"use client";
import { useState } from "react";
import Image from "next/image";
import { avatarImageStyle } from "./avatar-frame";
export function AvatarPhoto({
  src,
  initials,
  sizes,
  live,
}: {
  src: string;
  initials: string;
  sizes: string;
  live: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    initials
  ) : (
    <Image
      src={src}
      fill
      alt=""
      className="margin-avatar-image"
      sizes={sizes}
      loading="eager"
      style={avatarImageStyle}
      unoptimized={live || src.startsWith("/api/") || src.startsWith("blob:")}
      onError={() => setFailed(true)}
    />
  );
}
