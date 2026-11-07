import type { ReactNode } from "react";
import { brandCornerPath } from "./brand-mark";

/** The same decorative corner artwork frames wordmarks and larger surfaces. */
export function BrandCorner({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 272 272"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={brandCornerPath} />
    </svg>
  );
}

/** Shared wordmark frame and end-of-content signature; corners are decorative. */
export function BrandBrackets({ children }: { children: ReactNode }) {
  return (
    <span className="margin-brand-brackets">
      <BrandCorner className="margin-brand-corner-start" />
      <span>{children}</span>
      <BrandCorner className="margin-brand-corner-end" />
    </span>
  );
}
