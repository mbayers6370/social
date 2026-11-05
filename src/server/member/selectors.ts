import "server-only";
import { SocialError } from "@/server/social/errors";

export const active = { account: { is: { status: "ACTIVE" as const } } };
export const accountSelect = {
  displayName: true,
  username: true,
  bio: true,
  portraitPhotoId: true,
  messagingEnabled: true,
} as const;
export const unavailable = () =>
  new SocialError(404, "This item is unavailable");
export const pair = (a: string, b: string) =>
  a < b ? { lowId: a, highId: b } : { lowId: b, highId: a };
