import { portraitCropSchema, type PortraitCrop } from "@/lib/portrait-crop";
import { z } from "zod";
import { imageSchema, personSchema, type Person } from "@/features/feed/schema";
import type { ProfileTrack } from "@/features/profile/schema";
export const memberPreferencesSchema = z.object({
  postingTimeZone: z.string().optional(),
  showTopFriends: z.boolean().optional(),
  readingSize: z.enum(["standard", "larger", "extra-large"]),
  motion: z.enum(["system", "reduced"]),
  notifyComments: z.boolean(),
  notifyLikes: z.boolean(),
  notifyFriends: z.boolean(),
  notifyMessages: z.boolean(),
  messagingEnabled: z.boolean(),
});
export type MemberPreferences = z.infer<typeof memberPreferencesSchema>;
export const memberIdentitySchema = z.object({
  founder: z.boolean().optional(),
  person: personSchema.extend({
    // Live portraits use authenticated API URLs; feed fixtures use static assets.
    photo: imageSchema.extend({ src: z.string().min(1) }).optional(),
  }),
  username: z.string(),
  bio: z.string(),
  portraitPhotoId: z.string().nullable(),
  portraitCrop: portraitCropSchema.optional(),
  usernameChangedAt: z.string().nullable(),
  galleryVersion: z.number().int().nonnegative(),
  preferences: memberPreferencesSchema,
});
export type MemberIdentity = z.infer<typeof memberIdentitySchema>;
export type MemberContact = {
  person: Person;
  username: string;
  friendsSince?: string | null;
  relationship:
    "self" | "none" | "friends" | "incoming" | "outgoing" | "blocked";
};
export type MemberFriends = {
  contacts: MemberContact[];
  nextCursor: string | null;
};
export type MemberMessage = {
  id: string;
  body: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
};
export type MemberThread = {
  id: string;
  contact: Person;
  notebook: boolean;
  unread: boolean;
  preview: string;
  updatedAt: string | null;
  canSend: boolean;
};
export type MemberConversation = {
  thread: MemberThread;
  messages: MemberMessage[];
  nextCursor: string | null;
};
export type MemberActivity = {
  id: string;
  actor: Person;
  kind:
    | "friend_request"
    | "friend_accepted"
    | "comment"
    | "reply"
    | "like"
    | "message"
    | "space_post"
    | "space_invitation";
  spaceName?: string;
  invitation?: { id: string; space: { name: string } };
  href: string;
  createdAt: string;
  read: boolean;
};
export type MemberProfileDetails = {
  username: string;
  bio: string;
  portraitPhotoId: string | null;
  portraitCrop?: PortraitCrop;
  galleryVersion: number;
  onRepeat: ProfileTrack[];
};

export type MemberTopFriends = MemberFriends & { selected: Person[] };
