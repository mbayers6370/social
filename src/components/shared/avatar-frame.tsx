import type { CSSProperties, ReactNode } from "react";

// Critical crop styles belong in the initial markup, not delayed stylesheets or load handlers.
export const avatarImageStyle: CSSProperties = {
  display: "block",
  objectFit: "cover",
  objectPosition: "center",
  borderRadius: "50%",
  clipPath: "circle(50%)",
};

export function AvatarFrame({
  children,
  className,
  size = 40,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
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
        borderRadius: "50%",
        overflow: "hidden",
        clipPath: "circle(50%)",
      }}
    >
      {children}
    </span>
  );
}
