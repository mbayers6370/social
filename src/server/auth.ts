import "server-only";
import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { accountConfiguration } from "./account/config";
import { enforceRateLimit, RateLimitError } from "./security/rate-limit";

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}
export class EmailVerificationRequiredError extends UnauthorizedError {
  constructor() {
    super();
    this.message = "Verify your primary email address before continuing.";
    this.name = "EmailVerificationRequiredError";
  }
}
export class AuthenticationUnavailableError extends Error {
  constructor() {
    super("Authentication is temporarily unavailable. Please try again.");
    this.name = "AuthenticationUnavailableError";
  }
}

/** React cache is request/render-scoped, never a cross-request session cache. */
async function checkSession() {
  if (!accountConfiguration().configured)
    throw new AuthenticationUnavailableError();
  try {
    const identity = await auth();
    if (!identity.userId || !identity.sessionId) throw new UnauthorizedError();
    await enforceRateLimit("authSession", identity.userId);
    const client = await clerkClient();
    // JWT verification alone can outlive revocation. Consult current provider state.
    const session = await client.sessions.getSession(identity.sessionId);
    if (
      session.id !== identity.sessionId ||
      session.userId !== identity.userId ||
      session.status !== "active" ||
      (session.expireAt > 0 && session.expireAt <= Date.now()) ||
      (session.abandonAt > 0 && session.abandonAt <= Date.now())
    )
      throw new UnauthorizedError();
    if (
      !Number.isFinite(session.expireAt) ||
      !Number.isFinite(session.abandonAt) ||
      session.expireAt < 0 ||
      session.abandonAt < 0
    )
      throw new AuthenticationUnavailableError();
    const user = await client.users.getUser(identity.userId);
    if (user.id !== identity.userId || user.banned || user.locked)
      throw new UnauthorizedError();
    const email = user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    );
    return {
      subject: identity.userId,
      sessionId: identity.sessionId,
      user,
      verifiedEmail:
        email?.verification?.status === "verified" ? email.emailAddress : null,
    };
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof AuthenticationUnavailableError ||
      error instanceof RateLimitError
    )
      throw error;
    if (
      typeof error === "object" &&
      error &&
      "status" in error &&
      error.status === 404
    )
      throw new UnauthorizedError();
    throw new AuthenticationUnavailableError();
  }
}
const verifiedSession = cache(async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      checkSession(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AuthenticationUnavailableError()),
          10_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
});

export async function requireAccountSession(
  options: { verifiedEmail?: boolean } = {},
) {
  const session = await verifiedSession();
  if (options.verifiedEmail !== false && !session.verifiedEmail)
    throw new EmailVerificationRequiredError();
  return session;
}
export async function requireUser() {
  try {
    return (await requireAccountSession()).subject;
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError)
      redirect("/onboarding");
    if (error instanceof UnauthorizedError)
      redirect("/sign-in?reason=session-ended");
    throw error;
  }
}
/** Keep the existing service contract: only a verified subject crosses this boundary. */
export async function requireViewer() {
  return { id: (await requireAccountSession()).subject };
}
