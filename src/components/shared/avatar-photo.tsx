"use client";
import { useState } from "react";
import Image from "next/image";
import {
  avatarImageStyle,
  avatarShapeStyles,
  type AvatarShape,
} from "./avatar-frame";
export function AvatarPhoto({
  src,
  initials,
  sizes,
  live,
  shape = "circle",
}: {
  src: string;
  initials: string;
  sizes: string;
  live: boolean;
  shape?: AvatarShape;
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
      style={{ ...avatarImageStyle, ...avatarShapeStyles[shape] }}
      unoptimized={live || src.startsWith("/api/") || src.startsWith("blob:")}
      onError={() => setFailed(true)}
    />
  );
}
