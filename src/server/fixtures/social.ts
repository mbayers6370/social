import "server-only";
import { getDevelopmentFeed } from "./feed";
import { getDevelopmentScreens } from "./screens";
import type { Bootstrap, Photo } from "@/features/local-preview/model";
import type { PostMedia } from "@/features/feed/schema";
import { musicSelectionSchema } from "@/features/profile/music-schema";
import { canReadFriendsPost, type Friendship } from "@/lib/friend-audience";
import { containsPostLink } from "@/lib/platform-rules";
import { getDevelopmentNotifications } from "./notifications";

export function getDevelopmentSocial(): Bootstrap {
  const { posts } = getDevelopmentFeed(); // Runtime guard rejects production/test.
  const { profile } = getDevelopmentScreens();
  const people = [
    ...new Map(
      posts
        .flatMap((post) => [
          post.author,
          ...post.comments.map((comment) => comment.author),
        ])
        .map((person) => [person.id, person]),
    ).values(),
  ];
  const friends = [...new Set(posts.map((post) => post.author.id))].filter(
    (id) => id !== "ines",
  );
  const friendships: Friendship[] = friends.map((id) => ({
    people: ["ines", id],
    status: "accepted",
  }));
  // Directed requests exercise both sides of the local lifecycle; no request is sent.
  for (const [id, requestedBy] of [
    ["nadia", "nadia"],
    ["owen", "ines"],
  ]) {
    if (!friends.includes(id) && people.some((person) => person.id === id))
      friendships.push({
        people: ["ines", id],
        status: "pending",
        requestedBy,
      });
  }
  const bios: Record<string, string> = {
    theo: "Usually reading on the train. Send me book recommendations.",
    june: "Home cooking, dog photos, and catching up with friends.",
    samuel: "Weekend walks, coffee, and trying to get to the beach more often.",
    mara: "Tea, cooking, and whatever I'm reading this week.",
    nadia:
      "Early starts, long walks, and a camera in my bag. Usually planning the next trail.",
    owen: "Cycling across town, finding new lunch spots, and making time for friends.",
  };
  // Sample listening choices only; they are not written to anyone's music account.
  const listening = {
    june: musicSelectionSchema.parse([
      {
        id: "sample-june-dreams",
        title: "Dreams",
        artist: "Fleetwood Mac",
        spotifyUrl: "https://open.spotify.com/search/Fleetwood%20Mac%20Dreams",
      },
    ]),
    samuel: musicSelectionSchema.parse([
      {
        id: "sample-samuel-lovely-day",
        title: "Lovely Day",
        artist: "Bill Withers",
        spotifyUrl:
          "https://open.spotify.com/search/Bill%20Withers%20Lovely%20Day",
      },
    ]),
  };
  const samuel = people.find((person) => person.id === "samuel")!;
  const galleryPhotos: Record<string, PostMedia[]> = {
    samuel: [
      {
        description:
          "Samuel laughing beside the water, wearing a light hat and a gray hoodie",
        caption: "By the water.",
        aspect: "portrait",
        image: samuel.photo!,
      },
    ],
  };
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "America/Los_Angeles",
  });
  const profiles = people.map((person) => {
    if (person.id === profile.person.id) return { ...profile, onRepeat: [] };
    const visible = canReadFriendsPost("ines", person.id, friendships);
    const recent = posts.filter(
      (post) => visible && post.author.id === person.id,
    );
    const photos = visible
      ? [
          ...(galleryPhotos[person.id] ?? []),
          ...recent.flatMap((post) => post.media ?? []),
        ]
      : [];
    return {
      person,
      handle: person.id,
      bio: bios[person.id] ?? "Mostly updates for friends and family.",
      onRepeat:
        visible && person.id in listening
          ? listening[person.id as keyof typeof listening]
          : [],
      recent: recent.map((post) => ({
        id: post.id,
        createdAt: post.createdAt,
        date: date.format(new Date(post.createdAt)),
        body: post.paragraphs.join("\n\n"),
        image: post.media?.[0],
      })),
      photos: [
        ...new Map(photos.map((photo) => [photo.image.src, photo])).values(),
      ],
    };
  });
  const source = [
    ...new Map(
      [...profile.photos, ...posts[0].media!].map((photo) => [
        photo.image.src,
        photo,
      ]),
    ).values(),
  ];
  const photos: Photo[] = source.map((photo, index) => ({
    ...photo,
    id: `photo-ines-${index}`,
    ownerId: "ines",
    title: photo.caption,
    kind: "fixture",
    ...(index >= 3 ? { fromPostId: posts[0].id } : {}),
  }));
  const postingRecords = new Map(
    posts
      .filter((post) => post.author.id === profile.person.id)
      .map((post) => [
        post.id,
        {
          id: post.id,
          authorId: post.author.id,
          createdAt: post.createdAt,
          hasLink: containsPostLink(post),
          imageCount: post.media?.length ?? 0,
        },
      ]),
  );
  for (const post of profile.recent) {
    if (post.createdAt && !postingRecords.has(post.id))
      postingRecords.set(post.id, {
        id: post.id,
        authorId: profile.person.id,
        createdAt: post.createdAt,
        hasLink: containsPostLink({ body: post.body }),
        imageCount: post.image ? 1 : 0,
      });
  }
  const now = Date.now();
  const canonicalPosts = new Map(
    posts.map((post) => [post.id, { ...post, audience: "friends" as const }]),
  );
  for (const post of profile.recent) {
    if (!post.createdAt || canonicalPosts.has(post.id)) continue;
    canonicalPosts.set(post.id, {
      id: post.id,
      author: profile.person,
      createdAt: post.createdAt,
      expiresAt: new Date(
        Date.parse(post.createdAt) + 30 * 86400_000,
      ).toISOString(),
      paragraphs: [post.body],
      likes: 0,
      comments: [],
      audience: "friends",
      ...(post.image ? { media: [post.image] } : {}),
    });
  }
  return {
    posts: [...canonicalPosts.values()],
    notifications: getDevelopmentNotifications(posts, people, "ines", now),
    postingRecords: [...postingRecords.values()],
    now: new Date(now).toISOString(),
    viewerId: "ines",
    profiles,
    photos,
    gallery: photos.map((photo, index) => ({
      photoId: photo.id,
      featured: index < 3,
    })),
    galleryAdditions: photos.flatMap((photo) => {
      const first = [...canonicalPosts.values()]
        .filter(
          (post) =>
            post.author.id === "ines" &&
            post.media?.some((media) => media.image.src === photo.image.src),
        )
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
      return first ? [{ photoId: photo.id, createdAt: first.createdAt }] : [];
    }),
    friendships,
  };
}
