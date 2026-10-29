import { z } from "zod";
import { personSchema } from "@/features/feed/schema";
import { canReadFriendsPost, type Friendship } from "@/lib/friend-audience";
const id = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
export const notificationTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("conversation"),
    postId: z.string().regex(/^post-[a-z0-9-]+$/),
    ownerId: id,
    commentId: id.optional(),
    expiresAt: z.iso.datetime(),
  }),
  z.strictObject({ kind: z.literal("profile"), personId: id }),
  z.strictObject({ kind: z.literal("settings") }),
]);
export const notificationSchema = z
  .strictObject({
    id,
    recipientId: id,
    kind: z.enum([
      "comment",
      "reply",
      "friend_request",
      "friend_accepted",
      "like",
      "account",
    ]),
    actors: z.array(personSchema).max(3),
    actorCount: z.number().int().min(0).max(999),
    createdAt: z.iso.datetime(),
    read: z.boolean(),
    target: notificationTargetSchema,
  })
  .superRefine((value, context) => {
    if (
      value.actorCount < value.actors.length ||
      (value.kind !== "account" && !value.actors.length)
    )
      context.addIssue({
        code: "custom",
        message: "Invalid notification actors.",
      });
    const expected = ["comment", "reply", "like"].includes(value.kind)
      ? "conversation"
      : value.kind === "account"
        ? "settings"
        : "profile";
    if (value.target.kind !== expected)
      context.addIssue({
        code: "custom",
        message: "Invalid notification destination.",
      });
    if (
      (value.kind === "friend_request" || value.kind === "friend_accepted") &&
      (value.target.kind !== "profile" ||
        value.actors.length !== 1 ||
        value.actorCount !== 1 ||
        value.actors[0]?.id !== value.target.personId)
    )
      context.addIssue({
        code: "custom",
        message: "Invalid friendship actor.",
      });
  });
export const notificationsSchema = z
  .array(notificationSchema)
  .max(100)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "Duplicate notification.",
  );
export type LocalNotification = z.infer<typeof notificationSchema>;
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export const notificationPreferencesSchema = z.strictObject({
  replies: z.boolean(),
  friendships: z.boolean(),
  likes: z.boolean(),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type NotificationState = {
  readIds: string[];
  preferences: NotificationPreferences;
};
export const defaultNotificationPreferences: NotificationPreferences = {
  replies: true,
  friendships: true,
  likes: false,
};
export function initialNotificationState(
  rows: LocalNotification[],
  viewerId: string,
): NotificationState {
  return {
    readIds: rows
      .filter((row) => row.read && row.recipientId === viewerId)
      .map((row) => row.id),
    preferences: { ...defaultNotificationPreferences },
  };
}
export function visibleNotifications(
  rows: LocalNotification[],
  viewerId: string,
  state: NotificationState,
  now: number,
) {
  return rows
    .filter(
      (row) =>
        row.recipientId === viewerId &&
        Date.parse(row.createdAt) <= now &&
        (row.kind === "account" ||
          row.actors.some((actor) => actor.id !== viewerId)) &&
        (row.kind === "account" ||
          (row.kind === "like" && state.preferences.likes) ||
          (["comment", "reply"].includes(row.kind) &&
            state.preferences.replies) ||
          (["friend_request", "friend_accepted"].includes(row.kind) &&
            state.preferences.friendships)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function notificationAvailable(
  row: LocalNotification,
  viewerId: string,
  friendships: readonly Friendship[],
  now: number,
  profileIds: string[],
) {
  if (row.recipientId !== viewerId) return false;
  const target = row.target;
  if (target.kind === "conversation")
    return (
      Date.parse(target.expiresAt) > now &&
      canReadFriendsPost(viewerId, target.ownerId, friendships)
    );
  return target.kind !== "profile" || profileIds.includes(target.personId);
}
export function notificationText(row: LocalNotification, available: boolean) {
  if (!available) return "This content is no longer available.";
  const name = row.actors[0]?.name ?? "Someone";
  switch (row.kind) {
    case "comment":
      return `${name} commented on your post.`;
    case "reply":
      return `${name} replied to you.`;
    case "friend_request":
      return `${name} sent you a friend request.`;
    case "friend_accepted":
      return `You and ${name} are now friends.`;
    case "like":
      return `${name}${row.actorCount > 1 ? ` and ${row.actorCount - 1} ${row.actorCount === 2 ? "other" : "others"}` : ""} liked your post.`;
    case "account":
      return "About your account security settings.";
  }
}
export type NotificationAction =
  | { type: "read"; ids: string[] }
  | { type: "preferences"; patch: Partial<NotificationPreferences> };
export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  return action.type === "read"
    ? { ...state, readIds: [...new Set([...state.readIds, ...action.ids])] }
    : {
        ...state,
        preferences: notificationPreferencesSchema.parse({
          ...state.preferences,
          ...action.patch,
        }),
      };
}
