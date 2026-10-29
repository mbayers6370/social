import "server-only";
import type { FeedPost, Person } from "@/features/feed/schema";
import {
  notificationsSchema,
  type LocalNotification,
} from "@/features/notifications/model";
export function getDevelopmentNotifications(
  posts: FeedPost[],
  people: Person[],
  viewerId: string,
  now: number,
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  const person = (id: string) => people.find((item) => item.id === id)!;
  const conversation = (postId: string, commentId?: string) => {
    const post = posts.find((item) => item.id === postId)!;
    return {
      kind: "conversation" as const,
      postId,
      ownerId: post.author.id,
      expiresAt: post.expiresAt,
      ...(commentId ? { commentId } : {}),
    };
  };
  const row = (
    id: string,
    kind: LocalNotification["kind"],
    actors: Person[],
    minutes: number,
    target: LocalNotification["target"],
    read = false,
  ): LocalNotification => ({
    id,
    kind,
    actors,
    actorCount: actors.length,
    recipientId: viewerId,
    createdAt: new Date(now - minutes * 60_000).toISOString(),
    target,
    read,
  });
  return notificationsSchema.parse([
    row(
      "notice-reply",
      "reply",
      [person("june")],
      5,
      conversation("post-porch", "porch-2"),
    ),
    row(
      "notice-comment",
      "comment",
      [person("theo")],
      18,
      conversation("post-fog", "fog-1"),
    ),
    row("notice-friend", "friend_request", [person("nadia")], 42, {
      kind: "profile",
      personId: "nadia",
    }),
    {
      ...row(
        "notice-likes",
        "like",
        [person("june"), person("mara")],
        65,
        conversation("post-fog"),
      ),
      actorCount: 3,
    },
    row(
      "notice-friends",
      "friend_accepted",
      [person("mara")],
      180,
      { kind: "profile", personId: "mara" },
      true,
    ),
    row(
      "notice-expired",
      "comment",
      [person("theo")],
      1440,
      {
        ...conversation("post-fog"),
        postId: "post-expired",
        expiresAt: new Date(now - 60_000).toISOString(),
      },
      true,
    ),
    row("notice-account", "account", [], 2880, { kind: "settings" }, true),
  ]);
}
