"use client";
import { useState } from "react";
import { MemberProvider } from "./member-provider";
import { PrivateProfile } from "./private-profile";
import { MemberGallery } from "./member-gallery";
import { MemberFriends } from "./member-friends";
import { MemberSettings } from "./member-settings";
import { MemberMessages } from "./member-messages";
import { MemberFeed } from "./member-feed";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { SpacesList } from "@/features/spaces/spaces-list";
import {
  SpaceClientProvider,
  type SpaceClient,
} from "@/features/spaces/client";
import type { MemberIdentity, MemberConversation } from "./member-contracts";
import type { PrivateProfileData } from "./contracts";
import type { ConversationTarget } from "@/features/spaces/space-post-card";

/** Development rendering fixture. Requests are deliberately sent to a nonexistent
 * namespace so this view can never mutate a signed-in member's actual records.
 * Browser tests supply deterministic responses in that namespace. */
const client: SpaceClient = {
  request: (url, init) => fetch(`/__member_fixture${url}`, init),
  href: (url) => url,
  photoSrc: (id) => `/__member_fixture/api/photos/${id}`,
  preview: false,
};
export const sampleIdentity: MemberIdentity = {
  person: {
    id: "fictional-member",
    name: "Sample Member",
    initials: "SM",
    tone: "paper",
  },
  username: "sample_member",
  bio: "Small moments, kept close.",
  portraitPhotoId: null,
  usernameChangedAt: null,
  galleryVersion: 0,
  preferences: {
    readingSize: "standard",
    motion: "system",
    notifyComments: true,
    notifyLikes: false,
    notifyFriends: true,
    notifyMessages: true,
    messagingEnabled: true,
  },
};
const friend = {
  id: "fictional-friend",
  name: "Alex Example",
  initials: "AE",
  tone: "paper" as const,
};
export const sampleProfile: PrivateProfileData = {
  viewer: sampleIdentity.person,
  viewerId: sampleIdentity.person.id,
  profile: {
    id: sampleIdentity.person.id,
    name: sampleIdentity.person.name,
    messagingEnabled: true,
    username: sampleIdentity.username,
    bio: sampleIdentity.bio,
    relationship: "self",
    galleryVersion: 0,
    onRepeat: [],
  },
  posts: [
    {
      id: "fictional-post",
      body: "The long way home was worth it.",
      createdAt: "2026-11-02T18:00:00Z",
      expiresAt: "2026-12-02T18:00:00Z",
      photos: [
        {
          id: "fictional-photo",
          description: "A cup of tea on a table",
          width: 640,
          height: 960,
        },
      ],
    },
  ],
  gallery: [],
  requests: [],
  nextCursor: null,
};
export const sampleConversation: MemberConversation = {
  thread: {
    id: friend.id,
    contact: friend,
    notebook: false,
    canSend: true,
    unread: false,
    preview: "See you on Saturday.",
    updatedAt: "2026-11-02T19:00:00Z",
  },
  messages: [
    {
      id: "fictional-message",
      body: "See you on Saturday.",
      direction: "incoming",
      createdAt: "2026-11-02T19:00:00Z",
    },
  ],
  nextCursor: null,
};
export function MemberPreview({
  area,
  thread,
  conversationTarget,
  messagingEnabled = true,
  profileMessagingEnabled = true,
}: {
  area: string;
  thread?: string;
  conversationTarget?: ConversationTarget;
  messagingEnabled?: boolean;
  profileMessagingEnabled?: boolean;
}) {
  const [selected, setSelected] = useState(thread);
  const featuredCount = /^(?:profile|gallery)-featured-([123])$/.exec(
    area,
  )?.[1];
  const featuredProfile = featuredCount
    ? {
        ...sampleProfile,
        gallery: Array.from({ length: Number(featuredCount) }, (_, index) => ({
          ...sampleProfile.posts[0].photos[0],
          id: `featured-photo-${index + 1}`,
          featured: true,
        })),
      }
    : sampleProfile;
  const notebook: MemberConversation = {
    thread: {
      ...sampleConversation.thread,
      id: sampleIdentity.person.id,
      contact: sampleIdentity.person,
      notebook: true,
      preview: "A note for later.",
    },
    messages: [],
    nextCursor: null,
  };
  return (
    <SpaceClientProvider client={client}>
      <MemberProvider
        initial={{
          ...sampleIdentity,
          preferences: { ...sampleIdentity.preferences, messagingEnabled },
        }}
      >
        {area === "profile" ||
        area === "friend-profile" ||
        (Boolean(featuredCount) && area.startsWith("profile-")) ? (
          <PrivateProfile
            data={
              area === "friend-profile"
                ? {
                    ...sampleProfile,
                    profile: {
                      ...sampleProfile.profile,
                      id: friend.id,
                      name: friend.name,
                      username: "alex_example",
                      messagingEnabled: profileMessagingEnabled,
                      relationship: "friends",
                    },
                  }
                : featuredProfile
            }
            conversationTarget={conversationTarget}
          />
        ) : area === "gallery" ||
          area === "gallery-photos" ||
          (Boolean(featuredCount) && area.startsWith("gallery-")) ? (
          <MemberGallery
            data={
              featuredCount
                ? featuredProfile
                : area === "gallery-photos"
                  ? {
                      ...sampleProfile,
                      gallery: sampleProfile.posts[0].photos,
                    }
                  : sampleProfile
            }
          />
        ) : area === "friends" ? (
          <MemberFriends
            initial={{
              contacts: [
                {
                  person: friend,
                  username: "alex_example",
                  relationship: "friends",
                  friendsSince: "2026-03-12T12:00:00Z",
                },
              ],
              nextCursor: null,
            }}
          />
        ) : area === "settings" ? (
          <MemberSettings
            initial={sampleIdentity}
            safety={{ blocked: [], reports: [] }}
          />
        ) : area === "messages" ? (
          <MemberMessages
            initialThreads={[notebook.thread, sampleConversation.thread]}
            initialConversation={
              !selected || selected === notebook.thread.id
                ? notebook
                : sampleConversation
            }
            selectedId={selected}
            onSelect={setSelected}
            referenceTime="2026-11-02T20:00:00Z"
          />
        ) : area === "spaces" || area === "space-invitations" ? (
          <LiveAppShell active="spaces">
            <SpacesList
              data={{
                spaces: [],
                invitations:
                  area === "space-invitations"
                    ? [
                        {
                          id: "fictional-invitation",
                          space: { name: "Saturday Dinner" },
                        },
                      ]
                    : [],
                nextCursor: null,
              }}
            />
          </LiveAppShell>
        ) : (
          <MemberFeed
            data={{
              viewer: sampleIdentity.person,
              page: {
                posts:
                  area === "feed-posts"
                    ? [
                        {
                          ...sampleProfile.posts[0],
                          author: friend,
                          space: null,
                        },
                      ]
                    : [],
                nextCursor: null,
                hasFriends: area === "feed-posts",
              },
            }}
            referenceTime="2026-11-02T20:00:00Z"
          />
        )}
      </MemberProvider>
    </SpaceClientProvider>
  );
}
