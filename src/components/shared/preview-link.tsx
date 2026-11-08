import Link from "next/link";
import type { ComponentProps } from "react";
import { previewHref } from "@/lib/public-demo";

/** The shared interface uses its original destinations outside the portfolio target. */
export default function PreviewLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={typeof href === "string" ? previewHref(href) : href}
    />
  );
}
