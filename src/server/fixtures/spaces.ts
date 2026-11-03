import "server-only";
import { getDevelopmentFeed } from "./feed";
import { getDevelopmentScreens } from "./screens";
import type { SpacesPreviewData } from "@/features/spaces/preview-provider";
import type { SpaceDetails } from "@/features/spaces/contracts";

export function getDevelopmentSpaces(
  referenceTime?: string,
): SpacesPreviewData {
  if (process.env.NODE_ENV !== "development")
    throw Error("Development fixtures are unavailable");
  const feed = getDevelopmentFeed();
  const viewer = getDevelopmentScreens().profile.person;
  const people = [
    ...new Map(
      [viewer, ...feed.posts.map((p) => p.author)].map((p) => [p.id, p]),
    ).values(),
  ];
  const members: SpaceDetails["members"] = [
    viewer,
    ...people.filter((p) => ["theo", "june", "samuel"].includes(p.id)),
  ].map((p) => ({
    userId: p.id,
    name: p.name,
    role: p.id === viewer.id ? "ADMIN" : "MEMBER",
    rsvp: null,
  }));
  const room = (
    id: string,
    name: string,
    kind: "PRIVATE" | "GATHERING",
  ): SpaceDetails => ({
    id,
    name,
    kind,
    startsAt: kind === "GATHERING" ? "2027-06-01T09:00:00Z" : null,
    timeZone: kind === "GATHERING" ? "Asia/Tokyo" : null,
    location: kind === "GATHERING" ? "Kyoto, Japan" : null,
    archivedAt: null,
    memberCount: members.length,
    creatorId: viewer.id,
    viewerId: viewer.id,
    role: "ADMIN",
    includeInFeed: false,
    rsvp: null,
    members: structuredClone(members),
    blockedMembers: [],
  });
  const spaces = [
    room("japan-2027", "Japan 2027", "GATHERING"),
    room("saturday-dinner", "Saturday Dinner", "GATHERING"),
    room("reading-room", "The Reading Room", "PRIVATE"),
  ];
  spaces[1].startsAt = "2027-01-09T19:00:00Z";
  spaces[1].timeZone = "Europe/Paris";
  spaces[1].location = "At June’s";
  // Include an ordinary membership so leaving can be reviewed without credentials.
  const readingHost = people.find((p) => p.id === "theo")!;
  spaces[2].creatorId = readingHost.id;
  spaces[2].role = "MEMBER";
  spaces[2].members = spaces[2].members.map((member) => ({
    ...member,
    role: member.userId === readingHost.id ? "ADMIN" : "MEMBER",
  }));
  const now = referenceTime ? new Date(referenceTime) : new Date();
  const author = people.find((p) => p.id === "theo")!;
  const media = feed.posts.flatMap((p) => p.media ?? [])[0];
  const photos = media
    ? [
        {
          id: "sample-photo",
          description: media.description,
          width: media.image.width,
          height: media.image.height,
          src: media.image.src,
          ownerId: viewer.id,
        },
      ]
    : [];
  const post = (space: SpaceDetails, body: string, index: number) => ({
    id: `space-sample-${index}`,
    body,
    createdAt: new Date(now.getTime() - index * 3600_000).toISOString(),
    expiresAt: new Date(now.getTime() + 29 * 86400_000).toISOString(),
    author: { id: author.id, name: author.name },
    space: { id: space.id, name: space.name, archived: false },
    photos: [],
  });
  return {
    now: now.getTime(),
    viewer,
    people,
    spaces,
    photos,
    posts: [
      post(
        spaces[0],
        "I found a little place in Kyoto. What does everyone think about staying here for three nights?",
        1,
      ),
      post(spaces[0], "I bookmarked a few restaurants near the station.", 2),
      post(
        spaces[1],
        "I’ll bring something for dessert. What are we cooking?",
        3,
      ),
      post(spaces[2], "What should we read next month?", 4),
    ],
    comments: {
      "space-sample-1": [
        {
          id: "sample-comment",
          body: "That sounds lovely. Can we take a look at the neighbourhood?",
          createdAt: new Date(now.getTime() - 1800_000).toISOString(),
          author: { id: viewer.id, name: viewer.name },
        },
      ],
    },
  };
}
