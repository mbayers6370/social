import { isSpaceExpired } from "./lifecycle";
import type { Friendship } from "@/lib/friend-audience";
import type { SpacesPreviewData } from "./preview-provider";
const blocked = (
  relationships: readonly Friendship[],
  viewer: string,
  author: string,
) =>
  relationships.some(
    (r) =>
      r.status === "blocked" &&
      r.people.includes(viewer) &&
      r.people.includes(author),
  );
export function visibleSpacePosts(
  data: SpacesPreviewData,
  relationships: readonly Friendship[],
  now: number,
  spaceId?: string,
) {
  return data.posts.filter((post) => {
    const room = data.spaces.find((s) => s.id === post.space?.id);
    return (
      room &&
      !isSpaceExpired(room, now) &&
      room.members.some((m) => m.userId === data.viewer.id) &&
      Date.parse(post.expiresAt) > now &&
      !blocked(relationships, data.viewer.id, post.author.id) &&
      (spaceId
        ? room.id === spaceId
        : room.includeInFeed && post.author.id !== data.viewer.id)
    );
  });
}
export function visibleSpaceDetails(
  data: SpacesPreviewData,
  relationships: readonly Friendship[],
  id: string,
  now = data.now,
) {
  const room = data.spaces.find(
    (s) =>
      s.id === id &&
      !isSpaceExpired(s, now) &&
      s.members.some((m) => m.userId === data.viewer.id),
  );
  if (!room) return undefined;
  return {
    ...room,
    rsvp: room.startsAt && room.rsvpEnabled !== false ? room.rsvp : null,
    members: room.members
      .filter((m) => !blocked(relationships, data.viewer.id, m.userId))
      .map((member) => ({
        ...member,
        rsvp: room.startsAt && room.rsvpEnabled !== false ? member.rsvp : null,
      })),
    blockedMembers: room.members
      .filter((m) =>
        relationships.some(
          (r) =>
            r.status === "blocked" &&
            r.blockedBy === data.viewer.id &&
            r.people.includes(m.userId) &&
            r.people.includes(data.viewer.id),
        ),
      )
      .map((m) => ({ id: m.userId, name: m.name })),
  };
}
