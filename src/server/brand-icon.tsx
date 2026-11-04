import "server-only";
import { ImageResponse } from "next/og";
import {
  BrandMark,
  brandCornerPath,
  brandMonogramPath,
  brandMonogramTransform,
} from "@/components/shared/brand-mark";

export function brandSvgIcon(theme: "light" | "dark" | "system" = "system") {
  const color = theme === "dark" ? "#B9C65A" : "#454D24";
  const style =
    theme === "system"
      ? "<style>@media(prefers-color-scheme:dark){svg{fill:#B9C65A}}</style>"
      : "";
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 848 848" width="32" height="32" fill="${color}">${style}<path d="${brandCornerPath}" transform="translate(80 80)"/><path d="${brandMonogramPath}" transform="${brandMonogramTransform}"/><path d="${brandCornerPath}" transform="translate(768 768) rotate(180)"/></svg>`,
    {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

/** Static metadata icons render the supplied mark, with no account data or network calls. */
export function brandIcon(size: { width: number; height: number }) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAF9F6",
      }}
    >
      <BrandMark width={size.width} height={size.height} color="#454D24" />
    </div>,
    size,
  );
}
