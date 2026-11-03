import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  requireAccountSession,
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { AuthShell } from "@/features/account/auth-shell";
import { ProtectedSession } from "@/components/auth/protected-session";
import { MemberProvider } from "@/features/social/member-provider";
import { MemberService } from "@/server/member/service";
import { getDb } from "@/server/db";
import { privatePhotoStore } from "@/server/social/photo";
import { SocialError } from "@/server/social/errors";
export const dynamic = "force-dynamic";
export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1") notFound();
  let session;
  let identity;
  try {
    session = await requireAccountSession();
    identity = await new MemberService(getDb(), privatePhotoStore).identity(
      session.subject,
    );
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError)
      redirect("/onboarding");
    if (error instanceof UnauthorizedError)
      redirect("/sign-in?reason=session-ended");
    if (error instanceof SocialError && error.status === 403)
      return (
        <AuthShell
          title="Your account is waiting."
          intro="Your account needs approval and activation before you can use Margin."
        >
          <Link href="/onboarding">Account setup</Link>
        </AuthShell>
      );
    return (
      <AuthShell
        title="Account access is unavailable."
        intro="We couldn’t verify your session. Please try again in a moment."
      >
        <Link href="/app">Try again</Link>
        <Link href="/sign-in">Return to sign in</Link>
      </AuthShell>
    );
  }
  return (
    <ProtectedSession key={session.sessionId} sessionId={session.sessionId}>
      <MemberProvider initial={identity}>{children}</MemberProvider>
    </ProtectedSession>
  );
}
