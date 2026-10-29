import "server-only";
import { z } from "zod";
import { threadSchema } from "@/features/messages/schema";
import { postMediaSchema } from "@/features/feed/schema";
import inesCoffee from "@/assets/fixtures/Ines_Coffee.jpg";
import architecture from "@/assets/fixtures/architecture_Mexico.jpg";
import beach from "@/assets/fixtures/morning_beach.jpg";
import { getDevelopmentFeed, imageData } from "./feed";

/** Shares the feed's development-only guard; no authenticated data or endpoints. */
export function getDevelopmentScreens() {
  const { posts } = getDevelopmentFeed();
  const [ines, theo, june] = posts.map((post) => post.author);
  const media = postMediaSchema;
  const beachPhoto = media.parse({
    description:
      "A quiet sandy beach with a low beachside building beneath a warm morning sky",
    caption: "Morning at the beach.",
    aspect: "landscape",
    image: imageData(beach),
  });
  const architecturePhoto = media.parse({
    description:
      "An ornate stone building with carved details, balconies and green awnings",
    caption: "A building in Mexico.",
    aspect: "portrait",
    image: imageData(architecture),
  });
  const coffeePhoto = media.parse({
    description: "Ines holding a ceramic cup beside a café window",
    caption: "Coffee before work.",
    aspect: "portrait",
    image: imageData(inesCoffee),
  });
  const threads = z.array(threadSchema).parse([
    {
      id: "ines",
      contact: ines,
      unread: false,
      messages: [
        {
          id: "i-1",
          direction: "incoming",
          body: "Are you walking Chimney Rock this weekend?",
          createdAt: "2026-10-27T01:40:00Z",
        },
        {
          id: "i-2",
          direction: "incoming",
          body: "Samuel was asking.",
          createdAt: "2026-10-27T01:40:00Z",
        },
        {
          id: "i-3",
          direction: "outgoing",
          body: "Thinking Saturday, early. Want to come?",
          createdAt: "2026-10-27T02:02:00Z",
        },
        {
          id: "i-4",
          direction: "incoming",
          body: "Maybe! Depends on the fog.",
          createdAt: "2026-10-27T02:05:00Z",
        },
        {
          id: "i-5",
          direction: "incoming",
          body: "Ha. It always depends on the fog.",
          createdAt: "2026-10-27T02:05:00Z",
        },
        {
          id: "i-6",
          direction: "incoming",
          body: "Saturday works. I’ll bring the thermos.",
          createdAt: "2026-10-27T16:58:00Z",
        },
        {
          id: "i-7",
          direction: "incoming",
          body: "You bring the good bread from the place on Fourth.",
          createdAt: "2026-10-27T16:58:00Z",
        },
        {
          id: "i-8",
          direction: "outgoing",
          body: "Deal.",
          createdAt: "2026-10-27T17:04:00Z",
        },
        {
          id: "i-9",
          direction: "outgoing",
          body: "Meet at the lot at 8?",
          createdAt: "2026-10-27T17:04:00Z",
        },
        {
          id: "i-10",
          direction: "incoming",
          body: "8 is perfect. See you there.",
          createdAt: "2026-10-27T17:06:00Z",
        },
      ],
    },
    {
      id: "june",
      contact: june,
      unread: true,
      messages: [
        {
          id: "j-1",
          direction: "outgoing",
          body: "Would you send me that recipe when you have a moment?",
          createdAt: "2026-10-26T15:00:00Z",
        },
        {
          id: "j-2",
          direction: "incoming",
          body: "The recipe is in my grandmother’s handwriting. I’ll find it this afternoon.",
          createdAt: "2026-10-26T16:00:00Z",
        },
      ],
    },
    {
      id: "theo",
      contact: theo,
      unread: false,
      messages: [
        {
          id: "t-1",
          direction: "outgoing",
          body: "Did you finish the book? I’m still thinking about that last chapter.",
          createdAt: "2026-10-19T18:00:00Z",
        },
        {
          id: "t-2",
          direction: "incoming",
          body: "You were right about the ending.",
          createdAt: "2026-10-19T19:00:00Z",
        },
      ],
    },
  ]);
  return {
    threads,
    profile: {
      person: ines,
      handle: "ines",
      bio: "Landscape architect. Usually out walking, taking photos, or trying a new coffee place.",
      recent: [
        {
          id: "post-profile-beach",
          createdAt: "2026-10-26T15:00:00Z",
          date: "26 Oct",
          body: "Quick trip to the beach before work. Pretty windy, so we didn't stay long.",
          image: beachPhoto,
        },
        {
          id: posts[0].id,
          createdAt: posts[0].createdAt,
          date: "27 Oct",
          body: posts[0].paragraphs[0],
          image: posts[0].media?.[0],
        },
        {
          id: "post-profile-architecture",
          createdAt: "2026-10-21T16:00:00Z",
          date: "21 Oct",
          body: "Saw this building while walking around Mexico City. Had to stop for a photo.",
          image: architecturePhoto,
        },
      ],
      photos: [beachPhoto, architecturePhoto, coffeePhoto],
    },
  };
}
