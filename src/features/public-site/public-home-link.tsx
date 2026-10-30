"use client";
import { BrandLink } from "@/components/shared/brand-link";
import { useAccountSession } from "@/components/auth/account-session";
export function PublicHomeLink({ signedOutHref }: { signedOutHref: string }) {
  const session = useAccountSession();
  return (
    <BrandLink
      href={session?.signedIn ? "/" : signedOutHref}
      animate
      label={session?.signedIn ? "margin feed" : "margin home"}
    />
  );
}
