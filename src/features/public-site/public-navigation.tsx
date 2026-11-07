"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccountSession } from "@/components/auth/account-session";
import { LiveAppNavigation } from "@/components/layout/live-app-shell";
import { ScrollHeader } from "@/components/layout/scroll-header";
import { MemberProvider } from "@/features/social/member-provider";
import {
  MemberRequestError,
  requestMemberIdentity,
} from "@/features/social/member-client";
import type { MemberIdentity } from "@/features/social/member-contracts";
import { useSpaceClient } from "@/features/spaces/client";
import { PublicHomeLink } from "./public-home-link";

/** Public reading never redirects, ends a session or grants member access.
 * Identity is loaded only through the existing authenticated member endpoint. */
export function PublicNavigation({ homeHref }: { homeHref: string }) {
  const session = useAccountSession();
  const client = useSpaceClient();
  const id =
    session?.signedIn && session.managed ? session.loginSessionId : null;
  const canLoad = Boolean(id && session?.ready && session.available);
  const [result, setResult] = useState<{
    sessionId: string;
    identity?: MemberIdentity;
    setup?: boolean;
  }>();
  const current = result?.sessionId === id ? result : undefined;
  useEffect(() => {
    if (!id || !canLoad) return;
    const controller = new AbortController();
    void requestMemberIdentity(client, "/api/member/context", {
      signal: controller.signal,
    }).then(
      (identity) => {
        if (!controller.signal.aborted) setResult({ sessionId: id, identity });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({
            sessionId: id,
            setup: error instanceof MemberRequestError && error.status === 403,
          });
      },
    );
    return () => controller.abort();
  }, [id, canLoad, client]);
  if (canLoad && current?.identity)
    return (
      <MemberProvider key={id} initial={current.identity}>
        <LiveAppNavigation />
      </MemberProvider>
    );
  return (
    <ScrollHeader className="margin-public-header margin-topbar margin-navigation-theme">
      <PublicHomeLink signedOutHref={homeHref} />
      <nav aria-label="Public navigation" className="margin-public-primary">
        <Link href="/why-margin" className="margin-public-information">
          Why Margin
        </Link>
        <Link href="/how-it-works" className="margin-public-information">
          How it works
        </Link>
        {session && !session.ready ? (
          <span className="margin-public-account-loading" role="status">
            Loading account…
          </span>
        ) : session?.signedIn ? (
          <Link
            prefetch={false}
            href={
              current?.setup
                ? "/onboarding"
                : session.managed
                  ? "/app/feed"
                  : "/"
            }
            className="margin-public-sign-in"
          >
            {current?.setup ? "Account setup" : "Back to Margin"}
          </Link>
        ) : (
          <Link href="/sign-in" className="margin-public-sign-in">
            Sign in
          </Link>
        )}
        {(!session || (session.ready && !session.signedIn)) && (
          <Link href="/how-it-works#joining" className="margin-public-join">
            Have an invitation?
          </Link>
        )}
      </nav>
    </ScrollHeader>
  );
}
