import type { SpacesPreviewData } from "@/features/spaces/preview-provider";
import { previewBootstrap } from "./local-preview-fixture";
export function spacesFixture(): SpacesPreviewData {
  const personal = previewBootstrap();
  const viewer = personal.profiles[0].person;
  const author = personal.profiles[1].person;
  const room = {
    id: "sample-room",
    name: "Japan 2027",
    kind: "PRIVATE" as const,
    startsAt: null,
    timeZone: null,
    location: null,
    archivedAt: null,
    memberCount: 2,
    creatorId: viewer.id,
    viewerId: viewer.id,
    role: "ADMIN" as const,
    includeInFeed: false,
    rsvp: null,
    members: [
      {
        userId: viewer.id,
        name: viewer.name,
        role: "ADMIN" as const,
        rsvp: null,
      },
      {
        userId: author.id,
        name: author.name,
        role: "MEMBER" as const,
        rsvp: null,
      },
    ],
    blockedMembers: [],
  };
  return {
    now: Date.parse(personal.now),
    viewer,
    people: [viewer, author],
    spaces: [room],
    posts: [
      {
        id: "space-canonical",
        body: "Shared suggestion",
        createdAt: "2026-10-27T19:00:00Z",
        expiresAt: "2026-11-26T19:00:00Z",
        author,
        space: { id: room.id, name: room.name, archived: false },
        photos: [],
      },
    ],
    photos: [],
    comments: {},
  };
}
