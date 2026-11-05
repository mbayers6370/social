import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  requireAccountSession,
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { getDb } from "@/server/db";
import { SocialService } from "@/server/social/service";
import { privatePhotoStore } from "@/server/social/photo";
import { SocialError } from "@/server/social/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { AuthShell } from "@/features/account/auth-shell";
import { sharedProfilePath } from "@/lib/profile-links";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Member profile",
  robots: { index: false, follow: false },
};

export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1") notFound();
  const { username } = await params;
  if (!/^[a-z][a-z0-9_]{2,23}$/i.test(username)) notFound();
  const path = sharedProfilePath(username);
  let targetId: string;
  try {
    const session = await requireAccountSession();
    await enforceRateLimit("read", session.subject);
    targetId = await new SocialService(
      getDb(),
      privatePhotoStore,
    ).profileIdByUsername(session.subject, username.toLowerCase());
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError)
      redirect("/onboarding");
    if (error instanceof UnauthorizedError)
      redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
    if (error instanceof SocialError && error.status === 404) notFound();
    if (error instanceof SocialError && error.status === 403) redirect("/app");
    return (
      <AuthShell
        title="This profile couldn’t be loaded."
        intro="Please try again in a moment."
      >
        <Link href={path}>Try again</Link>
      </AuthShell>
    );
  }
  // The existing profile read checks friendship, blocking and media access again.
  redirect(`/app?person=${encodeURIComponent(targetId)}`);
}
