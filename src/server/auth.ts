import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

/** APIs and services use this instead of a page redirect. Never trust a submitted user ID. */
export async function requireViewer() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return { id: userId };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}
