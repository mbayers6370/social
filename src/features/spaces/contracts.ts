export type SpaceSummary = {
  id: string;
  name: string;
  kind: "PRIVATE" | "GATHERING" | "EVENT";
  startsAt: string | null;
  timeZone: string | null;
  location: string | null;
  archivedAt: string | null;
  memberCount: number;
  endsAt?: string | null;
  expiresAt?: string | null;
  ticketmasterId?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
};
export type SpaceListData = {
  spaces: SpaceSummary[];
  nextCursor: string | null;
  invitations: { id: string; space: { name: string } }[];
};
export type EventSearchPage = {
  events: (SpaceSummary & { isMember: boolean })[];
  nextCursor: string | null;
  notice?: string;
};
export type CatalogEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  location: string;
  imageUrl: string | null;
  sourceUrl: string | null;
};
export type SpaceDetails = SpaceSummary & {
  creatorId: string;
  viewerId: string;
  role: "ADMIN" | "MEMBER";
  includeInFeed: boolean;
  rsvp: "GOING" | "MAYBE" | "DECLINED" | null;
  members: {
    userId: string;
    name: string;
    role: "ADMIN" | "MEMBER";
    rsvp: "GOING" | "MAYBE" | "DECLINED" | null;
  }[];
  blockedMembers: { id: string; name: string }[];
};
export type SpacePost = {
  id: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  author: {
    id: string;
    name: string;
    photo?: import("@/features/feed/schema").Person["photo"];
  };
  space: { id: string; name: string; archived: boolean } | null;
  photos: { id: string; description: string; width: number; height: number }[];
};
export type SpacePostPage = { posts: SpacePost[]; nextCursor: string | null };
export type SpaceComments = {
  liked?: boolean;
  likeCount?: number;
  comments: {
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      photo?: import("@/features/feed/schema").Person["photo"];
    };
    replyTo?: string;
  }[];
  nextCursor: string | null;
  readOnly: boolean;
  viewer: {
    id: string;
    name: string;
    photo?: import("@/features/feed/schema").Person["photo"];
  };
};

export type SpaceInvitationCandidates = {
  members: {
    person: import("@/features/feed/schema").Person;
    username: string;
    friend: boolean;
  }[];
  hasMore: boolean;
};
