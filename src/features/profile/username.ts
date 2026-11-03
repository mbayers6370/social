import { z } from "zod";
import type { ProfilePreviewData } from "./schema";

const reserved = new Set([
  "admin",
  "administrator",
  "api",
  "help",
  "margin",
  "moderator",
  "notifications",
  "settings",
  "support",
  "system",
]);

export const isReservedUsername = (username: string) =>
  reserved.has(username.toLowerCase());

export const usernameSchema = z
  .string()
  .transform((value) => value.trim().replace(/^@/, "").toLowerCase())
  .pipe(
    z
      .string()
      .min(3, "Use at least 3 characters.")
      .max(24, "Use up to 24 characters.")
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "Start with a letter and use only letters, numbers or underscores.",
      ),
  );

type UsernameCheck =
  { available: true; username: string } | { available: false; message: string };

/** Local preview availability only; real accounts require an atomic server-side claim. */
export function checkUsername(
  input: unknown,
  profiles: readonly (Pick<ProfilePreviewData, "handle"> & {
    person: { id: string };
  })[],
  viewerId: string,
  changedAt: string | undefined,
  now: Date,
): UsernameCheck {
  const current = profiles.find((profile) => profile.person.id === viewerId);
  if (
    !current ||
    !Number.isFinite(now.getTime()) ||
    (changedAt !== undefined && !Number.isFinite(Date.parse(changedAt)))
  )
    return {
      available: false,
      message: "Username changes are unavailable right now.",
    };
  if (changedAt !== undefined)
    return {
      available: false,
      message: "Your one username change has already been used.",
    };
  const parsed = usernameSchema.safeParse(input);
  if (!parsed.success)
    return { available: false, message: parsed.error.issues[0].message };
  const username = parsed.data;
  if (username === current.handle.toLowerCase())
    return { available: false, message: "That’s your current username." };
  if (
    reserved.has(username) ||
    profiles.some(
      (profile) =>
        profile.person.id !== viewerId &&
        profile.handle.toLowerCase() === username,
    )
  )
    return { available: false, message: "That username isn’t available." };
  return { available: true, username };
}
