import type { Person } from "@/features/feed/schema";
import type { ProfileTrack } from "@/features/profile/schema";
export type MemberPreferences = {
  readingSize: "standard" | "larger" | "extra-large";
  motion: "system" | "reduced";
  notifyComments: boolean;
  notifyLikes: boolean;
  notifyFriends: boolean;
  notifyMessages: boolean;
  messagingEnabled: boolean;
};
export type MemberIdentity = {
  person: Person;
  username: string;
  bio: string;
  portraitPhotoId: string | null;
  usernameChangedAt: string | null;
  galleryVersion: number;
  preferences: MemberPreferences;
};
export type MemberContact = {
  person: Person;
  username: string;
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
  galleryVersion: number;
  onRepeat: ProfileTrack[];
};
