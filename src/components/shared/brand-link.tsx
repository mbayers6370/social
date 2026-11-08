"use client";
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useAccountSession } from "@/components/auth/account-session-context";
import { claimBrandEntrance } from "@/components/auth/login-session";
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
  const session = useAccountSession();
  const ref = useRef<HTMLAnchorElement>(null);
  const loginId = session?.loginSessionId;
  useLayoutEffect(() => {
    if (animate && session?.ready && loginId && claimBrandEntrance(loginId))
      ref.current?.setAttribute("data-entrance", "true");
  }, [animate, session?.ready, loginId]);
  return (
    <Link
      key={loginId ?? "signed-out"}
      ref={ref}
      href={href}
      prefetch={href.startsWith("/app") ? false : undefined}
      aria-label={label}
      className="margin-brand-link"
    >
      <BrandBrackets>
        <span className="margin-brand-name">margin</span>
      </BrandBrackets>
    </Link>
  );
}
