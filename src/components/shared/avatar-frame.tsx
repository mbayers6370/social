import type { CSSProperties, ReactNode } from "react";

export type AvatarShape = "circle" | "rounded";
export const avatarShapeStyles = {
  circle: { borderRadius: "50%", clipPath: "circle(50%)" },
  rounded: { borderRadius: "12px", clipPath: "inset(0 round 12px)" },
} satisfies Record<AvatarShape, CSSProperties>;

// The frame owns clipping, including the inner curve of its 1px border. Rounding
// the inset image separately leaves a gap between the photo and border corners.
// Critical crop styles belong in the initial markup, not delayed stylesheets or load handlers.
export const avatarImageStyle: CSSProperties = {
  display: "block",
  objectFit: "cover",
  objectPosition: "center",
};

export function AvatarFrame({
  children,
  className,
  size = 40,
  shape = "circle",
}: {
  children: ReactNode;
  className?: string;
  size?: number;
  shape?: AvatarShape;
}) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        width: `var(--margin-avatar-size, ${size}px)`,
        height: `var(--margin-avatar-size, ${size}px)`,
        border: "1px solid var(--avatar-border, #30383D)",
        overflow: "hidden",
        ...avatarShapeStyles[shape],
      }}
    >
      {children}
    </span>
  );
}
