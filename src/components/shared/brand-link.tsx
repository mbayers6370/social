import Link from "next/link";
import { BrandBrackets } from "./brand-brackets";

/** One accessible home link; the artwork is decorative within its named link. */
export function BrandLink({
  href = "/",
  label = "margin home",
  animate = false,
}: {
  href?: string;
  label?: string;
  animate?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="margin-brand-link"
      data-entrance={animate || undefined}
    >
      <BrandBrackets>
        <span className="margin-brand-name">margin</span>
      </BrandBrackets>
    </Link>
  );
}
