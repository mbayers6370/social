import type { Bootstrap } from "@/features/local-preview/model";
import type { FeedPost } from "@/features/feed/schema";
import type { LocalNotification } from "@/features/notifications/model";
export const notificationNow = "2026-10-27T20:00:00Z";
export function notificationFixture() {
  const ines = {
    id: "ines",
    name: "Ines",
    initials: "IA",
    tone: "paper" as const,
  };
  const theo = {
    id: "theo",
    name: "Theo",
    initials: "TM",
    tone: "sage" as const,
  };
  const nadia = {
    id: "nadia",
    name: "Nadia",
    initials: "NR",
    tone: "paper" as const,
  };
  const post: FeedPost = {
    id: "post-notification",
    author: ines,
    createdAt: "2026-10-27T16:00:00Z",
    expiresAt: "2026-11-26T16:00:00Z",
    paragraphs: ["Something worth discussing."],
    likes: 1,
    comments: [
      {
        id: "parent",
        author: ines,
        body: "What do you think?",
        createdAt: "2026-10-27T16:01:00Z",
      },
      {
        id: "reply",
        author: theo,
        body: "A thoughtful reply.",
        replyTo: "parent",
        createdAt: "2026-10-27T16:02:00Z",
      },
    ],
  };
  const target = {
    kind: "conversation" as const,
    postId: post.id,
    ownerId: ines.id,
    commentId: "reply",
    expiresAt: post.expiresAt,
  };
  const first: LocalNotification = {
    id: "reply-event",
    kind: "reply",
    actors: [theo],
    actorCount: 1,
    recipientId: ines.id,
    createdAt: "2026-10-27T19:55:00Z",
    read: false,
    target,
  };
  const notifications: LocalNotification[] = [
    first,
    {
      ...first,
      id: "friend-event",
      kind: "friend_request",
      actors: [nadia],
      target: { kind: "profile", personId: nadia.id },
      createdAt: "2026-10-27T19:45:00Z",
    },
    {
      ...first,
      id: "likes-event",
      kind: "like",
      actorCount: 3,
      createdAt: "2026-10-27T19:00:00Z",
    },
    {
      ...first,
      id: "expired-event",
      target: {
        ...target,
        postId: "post-expired",
        expiresAt: "2026-10-26T16:00:00Z",
      },
      createdAt: "2026-10-26T16:00:00Z",
      read: true,
    },
    {
      ...first,
      id: "account-event",
      kind: "account",
      actors: [],
      actorCount: 0,
      target: { kind: "settings" },
      createdAt: "2026-10-25T16:00:00Z",
      read: true,
    },
  ];
  const bootstrap: Bootstrap = {
    now: notificationNow,
    viewerId: ines.id,
    profiles: [ines, theo, nadia].map((person) => ({
      person,
      handle: person.id,
      bio: "A small introduction.",
      recent: [],
      photos: [],
    })),
    photos: [],
    gallery: [],
    friendships: [
      { people: [ines.id, theo.id], status: "accepted" },
      { people: [ines.id, nadia.id], status: "pending", requestedBy: nadia.id },
    ],
    notifications,
  };
  return { bootstrap, notifications, post };
}
