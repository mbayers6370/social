import type { ReactNode } from "react";
import { brandCornerPath } from "./brand-mark";

/** Shared wordmark frame and end-of-content signature; corners are decorative. */
export function BrandBrackets({ children }: { children: ReactNode }) {
  return (
    <span className="margin-brand-brackets">
      <svg
        className="margin-brand-corner-start"
        viewBox="0 0 272 272"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={brandCornerPath} />
      </svg>
      <span>{children}</span>
      <svg
        className="margin-brand-corner-end"
        viewBox="0 0 272 272"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={brandCornerPath} />
      </svg>
    </span>
  );
}
