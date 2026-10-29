// @vitest-environment node
import { expect, it, vi, afterEach } from "vitest";
import { changeFriendship, friendStatus } from "@/features/friends/model";
import { initialLocalState } from "@/features/local-preview/model";
import { canReadFriendsPost } from "@/lib/friend-audience";
import { notificationFixture } from "./helpers/notification-fixture";
import { getDevelopmentSocial } from "@/server/fixtures/social";
import { notificationSchema } from "@/features/notifications/model";
import { createPreviewExport } from "@/features/settings/preview-export";
afterEach(() => vi.unstubAllEnvs());
it("exports only the viewer's relationships without another person's profile or unrelated pairs", () => {
  const state = initialLocalState(notificationFixture().bootstrap);
  state.friendships.push({ people: ["theo", "nadia"], status: "accepted" });
  const data = createPreviewExport(
    state,
    "ines",
    { readingSize: "standard", motion: "system" },
    {},
  );
  expect(data.friendships).toEqual([
    { personId: "theo", status: "accepted" },
    { personId: "nadia", status: "pending", direction: "received" },
  ]);
});
it("requires mutual consent, supports cancellation, decline, removal and a fresh request", () => {
  let state = initialLocalState(notificationFixture().bootstrap);
  expect(friendStatus("ines", "nadia", state.friendships)).toBe("incoming");
  expect(canReadFriendsPost("ines", "nadia", state.friendships)).toBe(false);
  state = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "accept",
  });
  expect(canReadFriendsPost("ines", "nadia", state.friendships)).toBe(true);
  expect(canReadFriendsPost("nadia", "ines", state.friendships)).toBe(true);
  state = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "remove",
  });
  expect(canReadFriendsPost("ines", "nadia", state.friendships)).toBe(false);
  expect(canReadFriendsPost("nadia", "ines", state.friendships)).toBe(false);
  state = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "send",
  });
  expect(friendStatus("ines", "nadia", state.friendships)).toBe("outgoing");
  expect(friendStatus("nadia", "ines", state.friendships)).toBe("incoming");
  expect(canReadFriendsPost("nadia", "ines", state.friendships)).toBe(false);
  state = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "cancel",
  });
  expect(friendStatus("ines", "nadia", state.friendships)).toBe("none");
  state = changeFriendship(state, "nadia", {
    personId: "ines",
    action: "send",
  });
  state = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "decline",
  });
  expect(friendStatus("ines", "nadia", state.friendships)).toBe("none");
});
it("rejects self, unknown people, spoofed actors, wrong-direction, duplicate and stale actions without changing state", () => {
  const state = initialLocalState(notificationFixture().bootstrap);
  const before = structuredClone(state);
  for (const payload of [
    { personId: "ines", action: "send" },
    { personId: "missing", action: "send" },
    { personId: "nadia", action: "cancel" },
    { personId: "nadia", action: "send" },
    { personId: "theo", action: "accept" },
    { personId: "theo", action: "send" },
    { personId: "nadia", action: "accept", actorId: "nadia" },
    { personId: "https://evil.test", action: "send" },
    { personId: "nadia", action: "unblock" },
  ])
    expect(() => changeFriendship(state, "ines", payload)).toThrow();
  expect(() =>
    changeFriendship(state, "missing", { personId: "nadia", action: "send" }),
  ).toThrow();
  expect(state).toEqual(before);
  const next = changeFriendship(state, "ines", {
    personId: "nadia",
    action: "accept",
  });
  expect(() =>
    changeFriendship(next, "ines", { personId: "nadia", action: "accept" }),
  ).toThrow();
  expect(
    next.friendships.filter((pair) => pair.people.includes("nadia")),
  ).toHaveLength(1);
});
it("never lets requests or duplicate accepted records bypass a blocked relationship", () => {
  const state = initialLocalState(notificationFixture().bootstrap);
  state.friendships.push({ people: ["theo", "ines"], status: "blocked" });
  expect(friendStatus("ines", "theo", state.friendships)).toBe("blocked");
  for (const action of ["send", "accept", "decline", "cancel", "remove"])
    expect(() =>
      changeFriendship(state, "ines", { personId: "theo", action }),
    ).toThrow();
  expect(canReadFriendsPost("ines", "theo", state.friendships)).toBe(false);
  expect(
    friendStatus("ines", "nadia", [
      { people: ["ines", "nadia"], status: "pending" },
    ]),
  ).toBe("blocked");
});
it("seeds both request directions in development without serializing a nonfriend's private content", () => {
  vi.stubEnv("NODE_ENV", "development");
  const bootstrap = getDevelopmentSocial();
  expect(friendStatus("ines", "nadia", bootstrap.friendships)).toBe("incoming");
  expect(friendStatus("ines", "owen", bootstrap.friendships)).toBe("outgoing");
  for (const id of ["nadia", "owen"]) {
    const profile = bootstrap.profiles.find(
      (profile) => profile.person.id === id,
    )!;
    expect(profile.recent).toEqual([]);
    expect(profile.photos).toEqual([]);
  }
});
it("rejects a friendship notification whose displayed actor differs from the action target", () => {
  const row = notificationFixture().notifications[1];
  expect(
    notificationSchema.safeParse({
      ...row,
      target: { kind: "profile", personId: "theo" },
    }).success,
  ).toBe(false);
});

it("blocks friends or nonfriends, removes requests, and unblocks without restoring access", () => {
  for (const personId of ["theo", "nadia"]) {
    const initial = initialLocalState(notificationFixture().bootstrap);
    const blocked = changeFriendship(initial, "ines", {
      personId,
      action: "block",
    });
    expect(friendStatus("ines", personId, blocked.friendships)).toBe("blocked");
    expect(canReadFriendsPost("ines", personId, blocked.friendships)).toBe(
      false,
    );
    expect(canReadFriendsPost(personId, "ines", blocked.friendships)).toBe(
      false,
    );
    expect(() =>
      changeFriendship(blocked, personId, {
        personId: "ines",
        action: "unblock",
      }),
    ).toThrow();
    const unblocked = changeFriendship(blocked, "ines", {
      personId,
      action: "unblock",
    });
    expect(friendStatus("ines", personId, unblocked.friendships)).toBe("none");
    expect(canReadFriendsPost("ines", personId, unblocked.friendships)).toBe(
      false,
    );
  }
});
it("removing your own block cannot remove someone else's or an unattributed legacy block", () => {
  let state = initialLocalState(notificationFixture().bootstrap);
  state = changeFriendship(state, "ines", {
    personId: "theo",
    action: "block",
  });
  state = changeFriendship(state, "theo", {
    personId: "ines",
    action: "block",
  });
  state = changeFriendship(state, "ines", {
    personId: "theo",
    action: "unblock",
  });
  expect(friendStatus("ines", "theo", state.friendships)).toBe("blocked");
  state.friendships.push({ people: ["ines", "nadia"], status: "blocked" });
  expect(() =>
    changeFriendship(state, "ines", { personId: "nadia", action: "unblock" }),
  ).toThrow();
  expect(() =>
    changeFriendship(state, "ines", { personId: "ines", action: "block" }),
  ).toThrow();
});
