import "server-only";
import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/shared/brand-mark";

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
      <BrandMark width={size.width} height={size.height} color="#30383D" />
    </div>,
    size,
  );
}
