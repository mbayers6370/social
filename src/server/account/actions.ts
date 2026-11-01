"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/server/db";
import { enforceRateLimit } from "@/server/security/rate-limit";
import {
  INVITATION_COOKIE,
  invitationDigest,
  readInvitation,
} from "./invitations";
import { profileInputSchema } from "@/features/profile/schema";
import {
  usernameSchema,
  isReservedUsername,
} from "@/features/profile/username";

export async function acceptInvitation(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const code = String(form.get("code") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(code))
    return { error: "Enter the full invitation code you received." };
  if (process.env.MARGIN_REGISTRATION_ENABLED !== "1")
    return {
      error:
        "Account registration is not connected yet. Your code has not been used.",
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
      invitation.expiresAt <= new Date()
    )
      return { error: "That invitation is unavailable or has expired." };
  } catch {
    return { error: "Invitations could not be checked. Try again later." };
  }
  (await cookies()).set(INVITATION_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1800,
  });
  redirect("/sign-up");
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
    const user = await currentUser();
    if (!user) return { error: "Sign in before setting up your account." };
    await enforceRateLimit("mutation", user.id);
    const invitation = await readInvitation(user.id);
    if (!invitation)
      return {
        error:
          "A valid invitation is required. Return to your invitation code to continue.",
      };
    const email = user.emailAddresses.find(
      (item) => item.id === user.primaryEmailAddressId,
    );
    if (
      !email ||
      email.verification?.status !== "verified" ||
      (invitation.email &&
        invitation.email.toLowerCase() !== email.emailAddress.toLowerCase())
    )
      return { error: "Use the verified email address for this invitation." };
    const db = getDb();
    await db.$transaction(
      async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            expiresAt: { gt: new Date() },
            OR: [{ claimedBy: null }, { claimedBy: user.id }],
          },
          data: { claimedBy: user.id },
        });
        if (claimed.count !== 1) throw Error("Invitation unavailable");
        const owner = await tx.user.upsert({
          where: { clerkId: user.id },
          create: { clerkId: user.id },
          update: {},
        });
        const account = await tx.account.findUnique({
          where: { userId: owner.id },
        });
        if (account?.status === "DEACTIVATED")
          throw Error("Account unavailable");
        await tx.account.upsert({
          where: { userId: owner.id },
          create: {
            userId: owner.id,
            status: "PENDING",
            onboardedAt: new Date(),
            ageConfirmedAt: new Date(),
          },
          update: { onboardedAt: new Date(), ageConfirmedAt: new Date() },
        });
      },
      { isolationLevel: "Serializable" },
    );
    const client = await clerkClient();
    await client.users.updateUser(user.id, {
      firstName: details.data.name,
      lastName: "",
      username: username.data,
      publicMetadata: {
        ...user.publicMetadata,
        marginProfile: { bio: details.data.bio },
        marginOnboardingComplete: true,
      },
    });
    (await cookies()).delete(INVITATION_COOKIE);
    return { error: "", saved: true };
  } catch {
    return {
      error:
        "Your profile could not be saved. Check your invitation and try another username if needed. Your account has not been activated.",
    };
  }
}
