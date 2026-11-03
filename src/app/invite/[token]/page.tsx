import Link from "next/link";
import { AuthShell } from "@/features/account/auth-shell";
import { InvitationLanding } from "@/features/account/invitation-landing";
import { accountConfiguration } from "@/server/account/config";
import { getDb } from "@/server/db";
import {
  linkUnavailable,
  lookupInvitationLink,
} from "@/server/account/invitation-links";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "You’re invited to Margin",
  description: "A little of your day. A little closer to your people.",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let error =
    "Invitations are not open yet. Your link has not been used. Please return later.";
  if (
    accountConfiguration().registrationEnabled &&
    process.env.MARGIN_PRIVATE_BACKEND_ENABLED === "1"
  ) {
    try {
      const db = getDb();
      const link = await lookupInvitationLink(db, token);
      error = linkUnavailable(link) ?? "";
      if (
        link &&
        !error &&
        (await db.account.findUnique({ where: { userId: link.createdBy } }))
          ?.status !== "ACTIVE"
      )
        error = "This invitation is no longer available. Ask for a new link.";
    } catch {
      error =
        "We couldn’t check your invitation. Please try again in a moment.";
    }
  }
  return (
    <AuthShell
      title="A place for your people."
      intro={error || "You’re invited. Let’s start with your email."}
    >
      {!error && <InvitationLanding token={token} />}
      {error && (
        <p className="margin-auth-next">
          Already joined? <Link href="/sign-in">Sign in</Link>.
        </p>
      )}
    </AuthShell>
  );
}
