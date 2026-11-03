"use server";
import { clerkInvitationProvider } from "./invitation-clerk";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  requireAccountSession,
  UnauthorizedError,
  EmailVerificationRequiredError,
} from "@/server/auth";
import { accountConfiguration } from "./config";
import { completeAccountOnboarding, AccountSetupError } from "./service";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { INVITATION_COOKIE, invitationDigest } from "./invitations";
import {
  checkProviderInvitation,
  synchronizeInvitations,
} from "./invitation-provider";
import { linkUnavailable, tokenValid } from "./invitation-links";
import { profileInputSchema } from "@/features/profile/schema";
import {
  usernameSchema,
  isReservedUsername,
} from "@/features/profile/username";

export async function acceptInvitation(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const code = String(form.get("token") ?? "").trim();
  let ticket = String(form.get("ticket") ?? "");
  if (!tokenValid(code) || ticket.length > 8192)
    return {
      error: "Open the personal invitation from your email to continue.",
    };
  if (!accountConfiguration().registrationEnabled)
    return {
      error:
        "Account registration is not connected yet. Your invitation has not been used.",
    };
  try {
    // A shared bounded gate avoids collecting anonymous network identifiers.
    await enforceRateLimit("invitation", "invitation-verification");
    const invitation = await getDb().invitation.findUnique({
      where: { digest: invitationDigest(code) },
    });
    if (
      !invitation ||
      invitation.claimedBy ||
      invitation.revokedAt ||
      (!invitation.linkId && !invitation.founderSubject) ||
      invitation.expiresAt <= new Date()
    )
      return { error: "That invitation is unavailable or has expired." };
    if (invitation.founderSubject) {
      const identity = await requireAccountSession();
      if (
        identity.subject !== invitation.founderSubject ||
        identity.verifiedEmail?.toLowerCase() !==
          invitation.email?.toLowerCase()
      )
        return {
          error:
            "Sign in with the existing account selected for founder setup, then reopen this link.",
        };
      ticket = "";
    } else {
      if ((await auth()).userId) {
        const identity = await requireAccountSession({ verifiedEmail: false });
        if (
          identity.verifiedEmail?.toLowerCase() !==
          invitation.email?.toLowerCase()
        )
          return {
            error:
              "You’re signed in to a different account. Sign out, then reopen this invitation email to continue.",
          };
      }
      const link = await getDb().invitationLink.findUnique({
        where: { id: invitation.linkId! },
      });
      const reason = linkUnavailable(link);
      if (reason) return { error: reason };
      if (
        !(await checkProviderInvitation(
          await clerkInvitationProvider(),
          invitation,
        ))
      )
        return {
          error:
            "That invitation is unavailable or has expired. Ask for a new link.",
        };
    }
    if (!ticket && !invitation.founderSubject) {
      const identity = await requireAccountSession();
      if (
        identity.verifiedEmail?.toLowerCase() !==
        invitation.email?.toLowerCase()
      )
        return {
          error:
            "Open the invitation email and sign in with the address it was sent to.",
        };
    }
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return {
        error: "Sign in with your invited account, then reopen this link.",
      };
    return { error: "Invitations could not be checked. Try again later." };
  }
  (await cookies()).set(INVITATION_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1800,
  });
  redirect(
    ticket
      ? `/sign-up?__clerk_ticket=${encodeURIComponent(ticket)}`
      : "/onboarding",
  );
}

export async function saveOnboarding(
  _previous: { error: string; saved?: boolean },
  form: FormData,
): Promise<{ error: string; saved?: boolean }> {
  const details = profileInputSchema.safeParse({
    name: form.get("name"),
    bio: form.get("bio"),
  });
  const username = usernameSchema.safeParse(form.get("username"));
  if (
    !details.success ||
    !username.success ||
    (username.success && isReservedUsername(username.data)) ||
    form.get("adult") !== "yes"
  )
    return { error: "Check your name, username and age confirmation." };
  try {
    const session = await requireAccountSession();
    await enforceRateLimit("onboarding", session.subject);
    const db = getDb();
    const existing = await db.user.findUnique({
      where: { clerkId: session.subject },
      select: { account: { select: { onboardedAt: true } } },
    });
    if (
      !existing?.account?.onboardedAt &&
      !accountConfiguration().registrationEnabled
    )
      return {
        error:
          "Registration is currently closed. Your invitation has not been used.",
      };
    const cookieStore = await cookies();
    const code = cookieStore.get(INVITATION_COOKIE)?.value ?? null;
    const invitation = code
      ? await db.invitation.findUnique({
          where: { digest: invitationDigest(code) },
        })
      : null;
    if (
      invitation?.linkId &&
      !existing?.account?.onboardedAt &&
      !(await checkProviderInvitation(
        await clerkInvitationProvider(),
        invitation,
        true,
      ))
    )
      return {
        error:
          "Verify your personal invitation email before finishing account setup.",
      };
    const account = await completeAccountOnboarding(
      db,
      { subject: session.subject, verifiedEmail: session.verifiedEmail! },
      { ...details.data, username: username.data },
      code,
    );
    cookieStore.delete(INVITATION_COOKIE);
    if (invitation?.linkId) {
      try {
        await synchronizeInvitations(db, await clerkInvitationProvider());
      } catch {
        /* Durable revocation markers are retried by invitations:sync. */
      }
    }
    if (account.status !== "ACTIVE") return { error: "", saved: true };
  } catch (error) {
    if (error instanceof RateLimitError)
      return {
        error: `Too many account setup attempts. Wait ${error.retryAfterSeconds} seconds and try again.`,
      };
    if (error instanceof AccountSetupError) return { error: error.message };
    if (error instanceof EmailVerificationRequiredError)
      return { error: error.message };
    if (error instanceof UnauthorizedError)
      return { error: "Your session has ended. Sign in and try again." };
    return {
      error:
        "We couldn’t save your profile. Your details are still here. Please try again.",
    };
  }
  redirect("/app");
}
