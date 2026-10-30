import { z } from "zod";
import { FEED_TIME_ZONE } from "@/features/feed/format";
import type { ProfilePreviewData } from "./schema";

export const USERNAME_COOLDOWN_DAYS = 7;
export const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 86_400_000;
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

export function usernameChangeDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: FEED_TIME_ZONE,
  }).format(new Date(value));
}

export function nextUsernameChange(changedAt?: string) {
  return changedAt ? Date.parse(changedAt) + USERNAME_COOLDOWN_MS : null;
}

type UsernameCheck =
  { available: true; username: string } | { available: false; message: string };

/** Local preview availability only; real accounts require an atomic server-side claim. */
export function checkUsername(
  input: unknown,
  profiles: readonly ProfilePreviewData[],
  viewerId: string,
  changedAt: string | undefined,
  now: Date,
): UsernameCheck {
  const current = profiles.find((profile) => profile.person.id === viewerId);
  const next = nextUsernameChange(changedAt);
  if (
    !current ||
    !Number.isFinite(now.getTime()) ||
    (next !== null && !Number.isFinite(next))
  )
    return {
      available: false,
      message: "Username changes are unavailable right now.",
    };
  if (next !== null && now.getTime() < next)
    return {
      available: false,
      message: `You can change your username again on ${usernameChangeDate(new Date(next).toISOString())}.`,
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
