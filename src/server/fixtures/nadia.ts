import "server-only";
import { z } from "zod";
import lab from "@/assets/fixtures/Haddad.jpg";
import pipette from "@/assets/fixtures/Haddad-2.jpg";
import concert from "@/assets/fixtures/Haddad-concert.jpg";
import { imageData } from "./feed";
import { getDevelopmentSocial } from "./social";
import { postSchema, type PostMedia } from "@/features/feed/schema";
import { musicSelectionSchema } from "@/features/profile/music-schema";
import type { FriendProfileContent } from "@/features/local-preview/model";

/** Fictional preview content, withheld from the initial pending-request bootstrap. */
export function getDevelopmentNadiaContent(): FriendProfileContent {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  const profile = getDevelopmentSocial().profiles.find(
    (profile) => profile.person.id === "nadia",
  )!;
  const photos: PostMedia[] = [
    {
      image: imageData(lab),
      aspect: "portrait",
      caption: "An afternoon in the lab.",
      description:
        "Nadia in a white lab coat and purple gloves, working with dishes and sample bottles at a laboratory bench",
    },
    {
      image: imageData(pipette),
      aspect: "portrait",
      caption: "One careful step at a time.",
      description:
        "Nadia using a pipette at a laboratory workbench, with sample bottles in the foreground",
    },
    {
      image: imageData(concert),
      aspect: "landscape",
      caption: "Out of the lab, into the crowd.",
      description:
        "An outdoor concert crowd with raised hands, palm trees and warm sunlight filtering through the haze",
    },
  ];
  const posts = z
    .array(postSchema)
    .parse([
      {
        id: "post-nadia-lab",
        author: profile.person,
        createdAt: "2026-10-26T18:30:00Z",
        expiresAt: "2026-11-25T18:30:00Z",
        paragraphs: [
          "A good afternoon in the lab: one useful result and a much longer list of questions.",
          "Taking the small win, then going for a walk.",
        ],
        media: [photos[0]],
        likes: 7,
        comments: [],
      },
      {
        id: "post-nadia-concert",
        author: profile.person,
        createdAt: "2026-10-24T17:45:00Z",
        expiresAt: "2026-11-23T17:45:00Z",
        paragraphs: [
          "Swapped the lab coat for a very loud evening. Still have the last song stuck in my head.",
        ],
        media: [photos[2]],
        likes: 12,
        comments: [],
      },
      {
        id: "post-nadia-questions",
        author: profile.person,
        createdAt: "2026-10-21T16:15:00Z",
        expiresAt: "2026-11-20T16:15:00Z",
        paragraphs: [
          "Most of today was repeating a tiny part of an experiment. Not every day brings an answer, but a better question counts for something.",
          "Coffee with the team helped.",
        ],
        media: [photos[1]],
        likes: 5,
        comments: [],
      },
    ])
    .map((post) => ({ ...post, audience: "friends" as const }));
  const dates = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "America/Los_Angeles",
  });
  return {
    profile: {
      ...profile,
      photos,
      onRepeat: musicSelectionSchema.parse([
        {
          id: "sample-nadia-teardrop",
          title: "Teardrop",
          artist: "Massive Attack",
          spotifyUrl:
            "https://open.spotify.com/search/Massive%20Attack%20Teardrop",
        },
      ]),
      recent: posts.map((post) => ({
        id: post.id,
        createdAt: post.createdAt,
        date: dates.format(new Date(post.createdAt)),
        body: post.paragraphs.join("\n\n"),
        image: post.media?.[0],
      })),
    },
    posts,
  };
}
