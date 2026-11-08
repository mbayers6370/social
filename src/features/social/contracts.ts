export type PrivatePhoto = {
  featured?: boolean;
  position?: number;
  id: string;
  description: string;
  width: number;
  height: number;
};
export type PrivateProfileData = {
  viewer?: import("@/features/feed/schema").Person;
  viewerId: string;
  profile: {
    topFriends?: import("@/features/feed/schema").Person[];
    username?: string;
    bio?: string;
    portraitPhotoId?: string | null;
    portraitPhoto?: PrivatePhoto;
    portraitCrop?: import("@/lib/portrait-crop").PortraitCrop;
    galleryVersion?: number;
    onRepeat?: import("@/features/profile/schema").ProfileTrack[];
    id: string;
    name: string;
    messagingEnabled: boolean;
    relationship: "self" | "none" | "incoming" | "outgoing" | "friends";
  };
  posts: {
    id: string;
    body: string;
    createdAt: string;
    expiresAt: string;
    photos: PrivatePhoto[];
  }[];
  gallery: PrivatePhoto[];
  requests: { id: string; name: string }[];
  nextCursor: string | null;
};
