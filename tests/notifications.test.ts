import { afterEach, expect, it, vi } from "vitest";
import {
  initialNotificationState,
  notificationReducer,
  notificationSchema,
  notificationsSchema,
  visibleNotifications,
  notificationAvailable,
  notificationText,
} from "@/features/notifications/model";
import {
  notificationFixture,
  notificationNow,
} from "./helpers/notification-fixture";
import { getDevelopmentNotifications } from "@/server/fixtures/notifications";
import { previewPostState, previewReducer } from "@/features/feed/state";
afterEach(() => vi.unstubAllEnvs());
it("scopes activity to the recipient, hides future/self events and respects quiet defaults", () => {
  const { notifications } = notificationFixture();
  const first = notifications[0];
  const rows = [
    ...notifications,
    { ...first, id: "other", recipientId: "other", read: true },
    { ...first, id: "future", createdAt: "2027-01-01T00:00:00Z" },
    { ...first, id: "self", actors: [{ ...first.actors[0], id: "ines" }] },
  ];
  const state = initialNotificationState(rows, "ines");
  expect(state.readIds).not.toContain("other");
  const visible = visibleNotifications(
    rows,
    "ines",
    state,
    Date.parse(notificationNow),
  );
  expect(visible.map((row) => row.id)).toEqual([
    "reply-event",
    "friend-event",
    "expired-event",
    "account-event",
  ]);
  const muted = notificationReducer(state, {
    type: "preferences",
    patch: { replies: false, friendships: false },
  });
  expect(
    visibleNotifications(rows, "ines", muted, Date.parse(notificationNow)).map(
      (row) => row.id,
    ),
  ).toEqual(["account-event"]);
  const likes = notificationReducer(state, {
    type: "preferences",
    patch: { likes: true },
  });
  expect(
    notificationText(
      visibleNotifications(
        rows,
        "ines",
        likes,
        Date.parse(notificationNow),
      ).find((row) => row.id === "likes-event")!,
      true,
    ),
  ).toBe("Theo and 2 others liked your post.");
  expect(state.preferences.likes).toBe(false);
});
it("marks selected records idempotently without deleting history", () => {
  const { notifications } = notificationFixture();
  const state = initialNotificationState(notifications, "ines");
  const next = notificationReducer(state, {
    type: "read",
    ids: ["reply-event", "reply-event"],
  });
  expect(next.readIds.filter((id) => id === "reply-event")).toHaveLength(1);
  expect(state.readIds).not.toContain("reply-event");
  expect(
    visibleNotifications(
      notifications,
      "ines",
      next,
      Date.parse(notificationNow),
    ),
  ).toHaveLength(4);
});
it("treats expired, unauthorized and removed targets as unavailable without preserving excerpts", () => {
  const { notifications, bootstrap } = notificationFixture();
  const now = Date.parse(notificationNow);
  expect(
    notificationAvailable(notifications[0], "ines", [], now, ["ines"]),
  ).toBe(true);
  expect(
    notificationAvailable(notifications[0], "other", [], now, ["ines"]),
  ).toBe(false);
  expect(
    notificationAvailable(
      notifications[3],
      "ines",
      bootstrap.friendships,
      now,
      ["ines"],
    ),
  ).toBe(false);
  expect(notificationText(notifications[3], false)).toBe(
    "This content is no longer available.",
  );
  expect(notificationText(notifications[3], false)).not.toContain("Theo");
  expect(notificationAvailable(notifications[1], "ines", [], now, [])).toBe(
    false,
  );
  const stranger = {
    ...notifications[0],
    target: {
      ...notifications[0].target,
      kind: "conversation" as const,
      postId: "post-other",
      ownerId: "stranger",
      expiresAt: "2026-11-26T16:00:00Z",
    },
  };
  expect(
    notificationAvailable(stranger, "ines", bootstrap.friendships, now, [
      "stranger",
    ]),
  ).toBe(false);
});
it("rejects URL injection, private body fields, duplicate IDs and mismatched event destinations", () => {
  const { notifications } = notificationFixture();
  for (const target of [
    {
      kind: "conversation",
      postId: "https://evil.example",
      ownerId: "ines",
      expiresAt: "2026-11-26T16:00:00Z",
    },
    { kind: "profile", personId: "../api/private" },
    { kind: "settings", url: "javascript:alert(1)" },
  ])
    expect(
      notificationSchema.safeParse({ ...notifications[0], target }).success,
    ).toBe(false);
  expect(
    notificationSchema.safeParse({
      ...notifications[0],
      body: "private excerpt",
    }).success,
  ).toBe(false);
  expect(
    notificationSchema.safeParse({
      ...notifications[0],
      target: { kind: "settings" },
    }).success,
  ).toBe(false);
  expect(
    notificationsSchema.safeParse([notifications[0], notifications[0]]).success,
  ).toBe(false);
});
it("keeps development fixture loading disabled outside development", () => {
  for (const mode of ["test", "production"]) {
    vi.stubEnv("NODE_ENV", mode);
    expect(() =>
      getDevelopmentNotifications([], [], "ines", Date.now()),
    ).toThrow("Development fixtures are unavailable");
  }
});
it("reveals a notification's reply thread and parent pagination without collapsing other groups", () => {
  const before = {
    "post-one": {
      ...previewPostState({}, "post-one"),
      expandedReplies: ["existing"],
    },
  };
  const next = previewReducer(before, {
    type: "reveal",
    postId: "post-one",
    rootId: "parent",
    visibleCount: 8,
  });
  expect(next["post-one"].expandedReplies).toEqual(["existing", "parent"]);
  expect(next["post-one"].visibleCount).toBe(8);
  expect(before["post-one"].visibleCount).toBe(5);
});
