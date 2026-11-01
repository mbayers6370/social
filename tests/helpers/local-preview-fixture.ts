import type { Bootstrap } from "@/features/local-preview/model";

export function previewBootstrap(): Bootstrap {
  const person = {
    id: "ines",
    name: "Ines Alvarez",
    initials: "IA",
    tone: "paper" as const,
  };
  const photos = ["Morning", "Architecture", "Coffee", "Evening"].map(
    (title, index) => ({
      id: `photo-${index}`,
      ownerId: "ines",
      title,
      kind: "fixture" as const,
      description: `${title} photograph`,
      caption: title,
      aspect: "landscape" as const,
      image: {
        src: `/_next/static/media/photo-${index}.jpg`,
        width: 640,
        height: 480,
      },
    }),
  );
  return {
    now: "2026-10-27T20:00:00Z",
    viewerId: "ines",
    photos,
    gallery: photos.map((photo, index) => ({
      photoId: photo.id,
      featured: index < 3,
    })),
    friendships: [{ people: ["ines", "theo"], status: "accepted" }],
    profiles: [
      { person, handle: "ines", bio: "Walking slowly.", recent: [], photos },
      {
        person: {
          ...person,
          id: "theo",
          name: "Theo Marchetti",
          initials: "TM",
        },
        handle: "theo",
        bio: "Reading.",
        recent: [],
        photos: [],
      },
    ],
  };
}
