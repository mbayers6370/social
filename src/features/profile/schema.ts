import { z } from "zod";
import type { Person, PostMedia } from "@/features/feed/schema";
import type { ProfileTrack } from "./music-schema";
export type { ProfileTrack } from "./music-schema";

export const profileInputSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(80, "Use up to 80 characters."),
  bio: z.string().trim().max(300, "Keep your bio to 300 characters."),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfilePreviewData = {
  person: Person;
  handle: string;
  bio: string;
  onRepeat?: ProfileTrack[];
  recent: {
    id: string;
    createdAt?: string;
    date: string;
    body: string;
    image?: PostMedia;
  }[];
  photos: PostMedia[];
};
