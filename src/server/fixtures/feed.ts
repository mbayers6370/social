import "server-only";
import { z } from "zod";
import { postSchema, type FeedPost, type Person } from "@/features/feed/schema";
import fog from "@/assets/fixtures/fog.jpg";
import dog from "@/assets/fixtures/dog.jpg";
import tea from "@/assets/fixtures/tea.jpg";
import inesCoffee from "@/assets/fixtures/Ines_Coffee.jpg";
import beach from "@/assets/fixtures/morning_beach.jpg";
import street from "@/assets/fixtures/long-way-round.jpg";
import samuelPortrait from "@/assets/fixtures/Okafor-profile.jpg";
import samuelBeach from "@/assets/fixtures/Okafor-post.jpg";
import juneBirthday from "@/assets/fixtures/park-1.jpg";
import juneFriends from "@/assets/fixtures/park-2.jpg";
import theoPortrait from "@/assets/fixtures/Theo-profile.jpg";
import theoRome from "@/assets/fixtures/Theo-Roma-Walk.jpg";
import theoFootball from "@/assets/fixtures/Theo-football.jpg";
import maraPortrait from "@/assets/fixtures/mara-profile.jpg";
import maraRiver from "@/assets/fixtures/mara-photography.jpg";
import maraStreet from "@/assets/fixtures/mara-photography-2.jpg";
import nadiaPortrait from "@/assets/fixtures/Haddad-3.jpg";

export function imageData(image: {
  src: string;
  width: number;
  height: number;
}) {
  return { src: image.src, width: image.width, height: image.height };
}

const ines: Person = {
  id: "ines",
  name: "Ines Alvarez",
  initials: "IA",
  tone: "paper",
  photo: imageData(inesCoffee),
};
const theo: Person = {
  id: "theo",
  name: "Theo Marchetti",
  initials: "TM",
  tone: "sage",
  photo: imageData(theoPortrait),
};
const june: Person = {
  id: "june",
  name: "June Park",
  initials: "JP",
  tone: "sand",
  photo: imageData(juneFriends),
};
const samuel: Person = {
  id: "samuel",
  name: "Samuel Okafor",
  initials: "SO",
  tone: "paper",
  photo: imageData(samuelPortrait),
};
const mara: Person = {
  id: "mara",
  name: "Mara Lindqvist",
  initials: "ML",
  tone: "sage",
  photo: imageData(maraPortrait),
};
const nadia: Person = {
  id: "nadia",
  name: "Nadia Haddad",
  initials: "NH",
  tone: "paper",
  photo: imageData(nadiaPortrait),
};
const referenceTime = "2026-10-27T17:42:00Z";

const posts: FeedPost[] = [
  {
    id: "post-fog",
    author: ines,
    createdAt: "2026-10-27T16:42:00Z",
    expiresAt: "2026-11-26T16:42:00Z",
    paragraphs: [
      "Went for a walk at Point Reyes this morning. It was foggy at first, but it cleared up on the way back. A few photos from the week.",
    ],
    media: [
      {
        description:
          "Sunlight through coastal haze over green headlands and the sea",
        caption: "Point Reyes walk.",
        aspect: "landscape",
        image: imageData(fog),
      },
      {
        description:
          "A quiet sandy beach and a beachside building beneath a warm morning sky",
        caption: "Morning at the beach.",
        aspect: "landscape",
        image: imageData(beach),
      },
      {
        description:
          "A narrow street between colorful buildings with balconies and open windows",
        caption: "Walk through town.",
        aspect: "landscape",
        image: imageData(street),
      },
    ],
    likes: 48,
    comments: [
      {
        id: "fog-1",
        author: theo,
        body: "Looks like a good walk. Did it clear up by the time you got back?",
        createdAt: "2026-10-27T16:44:00Z",
      },
      {
        id: "fog-2",
        author: june,
        body: "My sister and I went last month. We should all go sometime.",
        createdAt: "2026-10-27T16:48:00Z",
      },
      {
        id: "fog-3",
        author: samuel,
        body: "Is this the Chimney Rock trail? Thinking of going Saturday.",
        createdAt: "2026-10-27T16:54:00Z",
      },
      {
        id: "fog-4",
        author: ines,
        body: "Yep! We parked by the old lifeboat station. Get there early.",
        createdAt: "2026-10-27T17:02:00Z",
        replyTo: "fog-3",
      },
      {
        id: "fog-5",
        author: mara,
        body: "Adding this to my weekend list.",
        createdAt: "2026-10-27T17:10:00Z",
      },
      {
        id: "fog-6",
        author: nadia,
        body: "We went in August and could barely see the water. Still had a good time.",
        createdAt: "2026-10-27T17:14:00Z",
      },
      {
        id: "fog-7",
        author: theo,
        body: "Did you take the lower path back or the ridge?",
        createdAt: "2026-10-27T17:17:00Z",
      },
      {
        id: "fog-8",
        author: ines,
        body: "We took the ridge. Better views on the way back.",
        createdAt: "2026-10-27T17:22:00Z",
        replyTo: "fog-7",
      },
      {
        id: "fog-9",
        author: {
          id: "owen",
          name: "Owen Price",
          initials: "OP",
          tone: "sage",
        },
        body: "I've been meaning to go. Might try it this weekend.",
        createdAt: "2026-10-27T17:30:00Z",
      },
      {
        id: "fog-10",
        author: june,
        body: "Don't forget a jacket. It's colder than you expect.",
        createdAt: "2026-10-27T17:36:00Z",
      },
    ],
  },
  {
    id: "post-book",
    author: theo,
    createdAt: "2026-10-27T15:15:00Z",
    expiresAt: "2026-11-26T15:15:00Z",
    paragraphs: [
      "Finished my book on the train home. If anyone needs something to read, you can borrow it.",
      "Need a new recommendation for the commute.",
    ],
    likes: 0,
    comments: [],
  },
  {
    id: "post-porch",
    author: june,
    createdAt: "2026-10-27T14:03:00Z",
    expiresAt: "2026-11-26T14:03:00Z",
    paragraphs: [
      "Made it halfway through the gardening before Biscuit claimed the porch. Taking a break for lunch.",
    ],
    media: [
      {
        description: "A dog resting on a tiled porch beside a glass door",
        caption: "Biscuit on the porch.",
        aspect: "portrait",
        image: imageData(dog),
      },
    ],
    likes: 12,
    comments: [
      {
        id: "porch-1",
        author: ines,
        body: "Looks like he's settled in for the day.",
        createdAt: "2026-10-27T16:10:00Z",
      },
      {
        id: "porch-2",
        author: june,
        body: "He's been out there all afternoon.",
        createdAt: "2026-10-27T16:20:00Z",
        replyTo: "porch-1",
      },
    ],
  },
  {
    id: "post-notebook",
    author: samuel,
    createdAt: "2026-10-27T04:30:00Z",
    expiresAt: "2026-11-26T04:30:00Z",
    paragraphs: [
      "Trying one notebook for work notes and shopping lists. Found a few ideas here that might help.",
    ],
    link: {
      title: "Notebook ideas",
      url: "https://example.org/",
    },
    likes: 7,
    comments: [],
  },
  {
    id: "post-tea",
    author: mara,
    createdAt: "2026-10-27T01:10:00Z",
    expiresAt: "2026-11-26T01:10:00Z",
    paragraphs: [
      "Tea and a few chapters before dinner. Still haven't decided what to cook.",
    ],
    media: [
      {
        description:
          "A cup on an open book beside a vintage radio and a potted plant",
        caption: "Tea break.",
        aspect: "landscape",
        image: imageData(tea),
      },
    ],
    likes: 19,
    comments: [],
  },
  {
    id: "post-june-birthday",
    author: june,
    createdAt: "2026-10-25T20:00:00Z",
    expiresAt: "2026-11-24T20:00:00Z",
    paragraphs: [
      "Turned 30 this weekend. We had cake at home and ordered way too much food. Thanks for all the birthday messages!",
    ],
    media: [
      {
        description:
          "A person holding a birthday cake with two lit candles and the words 30. Really?",
        caption: "Birthday cake.",
        aspect: "portrait",
        image: imageData(juneBirthday),
      },
    ],
    likes: 23,
    comments: [
      {
        id: "birthday-1",
        author: ines,
        body: "Happy birthday! That cake looks great.",
        createdAt: "2026-10-25T20:15:00Z",
      },
    ],
  },
  {
    id: "post-samuel-beach",
    author: samuel,
    createdAt: "2026-10-24T18:30:00Z",
    expiresAt: "2026-11-23T18:30:00Z",
    paragraphs: [
      "Stopped at the beach on the way home. It was too cold to swim, but we stayed for a bit.",
    ],
    media: [
      {
        description:
          "Waves reaching a sandy beach with rocks and a headland in the distance",
        caption: "Afternoon at the beach.",
        aspect: "portrait",
        image: imageData(samuelBeach),
      },
    ],
    likes: 8,
    comments: [
      {
        id: "samuel-beach-1",
        author: june,
        body: "We should take the dogs next time.",
        createdAt: "2026-10-24T19:05:00Z",
      },
    ],
  },
  {
    id: "post-june-lunch",
    author: june,
    createdAt: "2026-10-23T19:10:00Z",
    expiresAt: "2026-11-22T19:10:00Z",
    paragraphs: [
      "Lunch with Maya yesterday. We said we'd stay for an hour and ended up there all afternoon.",
    ],
    media: [
      {
        description:
          "Two friends smiling over a book at a table beside a sunny window",
        caption: "Lunch with a friend.",
        aspect: "landscape",
        image: imageData(juneFriends),
      },
    ],
    likes: 14,
    comments: [],
  },
  {
    id: "post-samuel-lunch",
    author: samuel,
    createdAt: "2026-10-22T16:20:00Z",
    expiresAt: "2026-11-21T16:20:00Z",
    paragraphs: [
      "Does anyone have a good lunch spot near the station? Getting tired of the same sandwich.",
    ],
    likes: 2,
    comments: [],
  },
  {
    id: "post-samuel-bookshelf",
    author: samuel,
    createdAt: "2026-10-20T18:00:00Z",
    expiresAt: "2026-11-19T18:00:00Z",
    paragraphs: [
      "Spent most of Sunday putting together a bookshelf. It fits, but one shelf is definitely the wrong way around.",
      "Calling that good enough for now.",
    ],
    likes: 6,
    comments: [],
  },
  {
    id: "post-theo-rome",
    author: theo,
    createdAt: "2026-10-19T17:00:00Z",
    expiresAt: "2026-11-18T17:00:00Z",
    paragraphs: [
      "A slow walk through Rome. Stopped here for a while before finding somewhere for coffee.",
    ],
    media: [
      {
        description:
          "People walking along a gravel path beneath tall umbrella pines, with a dome visible in the distance",
        caption: "An afternoon walk in Rome.",
        aspect: "portrait",
        image: imageData(theoRome),
      },
    ],
    likes: 5,
    comments: [],
  },
  {
    id: "post-theo-football",
    author: theo,
    createdAt: "2026-10-18T16:30:00Z",
    expiresAt: "2026-11-17T16:30:00Z",
    paragraphs: [
      "Sunday football. We lost, but it was good to get everyone out again.",
    ],
    media: [
      {
        description:
          "Two football players competing for the ball on a sunlit grass pitch",
        caption: "Sunday football.",
        aspect: "landscape",
        image: imageData(theoFootball),
      },
    ],
    likes: 8,
    comments: [],
  },
  {
    id: "post-mara-river",
    author: mara,
    createdAt: "2026-10-17T18:40:00Z",
    expiresAt: "2026-11-16T18:40:00Z",
    paragraphs: [
      "Took the camera out after dinner. Stayed by the water until the lights came on.",
    ],
    media: [
      {
        description:
          "A river at dusk with illuminated waterfront buildings and a church spire beneath a blue evening sky",
        caption: "By the water after sunset.",
        aspect: "landscape",
        image: imageData(maraRiver),
      },
    ],
    likes: 11,
    comments: [],
  },
  {
    id: "post-mara-street",
    author: mara,
    createdAt: "2026-10-16T14:15:00Z",
    expiresAt: "2026-11-15T14:15:00Z",
    paragraphs: [
      "The light on this street made me stop. Almost walked past without looking up.",
    ],
    media: [
      {
        description:
          "A narrow cobbled street between yellow buildings, looking up toward blue sky and white clouds",
        caption: "Looking up on the way home.",
        aspect: "portrait",
        image: imageData(maraStreet),
      },
    ],
    likes: 9,
    comments: [],
  },
];

/** Never imported into the client graph or offered as a production auth fallback. */
export function getDevelopmentFeed() {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return { posts: z.array(postSchema).max(50).parse(posts), referenceTime };
}
