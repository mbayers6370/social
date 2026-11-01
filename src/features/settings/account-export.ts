import type {
  LocalState,
  Preferences,
  PostInput,
  Photo,
} from "@/features/local-preview/model";
import type { PreviewState } from "@/features/feed/state";
import type { PreviewMessage, PreviewThread } from "@/features/messages/schema";
import type {
  NotificationState,
  LocalNotification,
} from "@/features/notifications/model";
import type { SafetyReport } from "@/features/safety/model";
import { createPreviewExport } from "./preview-export";

export const exportSections = [
  {
    id: "profile",
    label: "Profile & music",
    detail: "Name, username, bio, portrait reference and On Repeat.",
  },
  {
    id: "posts",
    label: "Your posts",
    detail: "Writing, links, dates and photograph references.",
  },
  {
    id: "photographs",
    label: "Photographs & gallery",
    detail:
      "Your photo library, descriptions, gallery arrangement and original files.",
  },
  {
    id: "comments",
    label: "Comments & likes",
    detail:
      "Your comments, edits, deletion placeholders and liked post references.",
  },
  {
    id: "friendships",
    label: "Friends & requests",
    detail: "Accepted friends, pending requests and blocked relationships.",
  },
  {
    id: "messages",
    label: "Messages",
    detail: "Your available conversations and sent messages.",
  },
  { id: "notebook", label: "Notebook", detail: "Your notes to yourself." },
  {
    id: "drafts",
    label: "Unpublished drafts",
    detail: "Post, comment and unsent message drafts.",
  },
  {
    id: "notifications",
    label: "Notifications",
    detail: "Available activity, read states and notification preferences.",
  },
  {
    id: "preferences",
    label: "Reading preferences",
    detail: "Text size and motion settings.",
  },
  {
    id: "reports",
    label: "Your safety reports",
    detail: "The reports you saved and their current status.",
  },
] as const;
export type ExportSection = (typeof exportSections)[number]["id"];
export type AccountExportSource = {
  state: LocalState;
  viewerId: string;
  preferences: Preferences;
  interactions: PreviewState;
  notifications: NotificationState;
  notificationRows: LocalNotification[];
  threads: PreviewThread[];
  messageAdditions: Record<string, PreviewMessage[]>;
  messageDrafts: Record<string, string>;
  notebookNotes: PreviewMessage[];
  draft: PostInput;
  reports: SafetyReport[];
};
export type AccountArchive = {
  version: number;
  scope: string;
  exportedAt: string;
  included: ExportSection[];
  unavailable: string[];
  data: Record<string, unknown>;
};
export function accountPhotographs(
  state: LocalState,
  viewerId: string,
): Photo[] {
  const photos = state.photos.filter((photo) => photo.ownerId === viewerId);
  const portrait = state.profiles.find(
    (profile) => profile.person.id === viewerId,
  )?.person.photo;
  if (portrait && !photos.some((photo) => photo.image.src === portrait.src))
    return [
      ...photos,
      {
        id: "profile-portrait",
        ownerId: viewerId,
        title: "Profile photograph",
        description: "Your profile photograph",
        caption: "",
        aspect: "portrait",
        kind: "fixture",
        image: portrait,
      },
    ];
  return photos;
}
export function createAccountArchive(
  source: AccountExportSource,
  selected: readonly ExportSection[],
  conversationId?: string,
  now = new Date(),
): AccountArchive {
  const allowed = new Set(exportSections.map((section) => section.id));
  if (!selected.length || selected.some((item) => !allowed.has(item)))
    throw new Error("Choose at least one category.");
  const included = [...new Set(selected)];
  const base = createPreviewExport(
    source.state,
    source.viewerId,
    source.preferences,
    source.interactions,
    now,
    source.notifications,
  );
  const data: Record<string, unknown> = {};
  const owns = accountPhotographs(source.state, source.viewerId);
  for (const section of included) {
    switch (section) {
      case "profile":
        data.profile = {
          ...base.profile,
          portraitPhotoId:
            owns.find(
              (photo) =>
                photo.image.src ===
                source.state.profiles.find(
                  (profile) => profile.person.id === source.viewerId,
                )?.person.photo?.src,
            )?.id ?? null,
        };
        break;
      case "posts":
        data.posts = base.posts.map((post) => ({
          ...post,
          photographIds:
            source.state.posts
              .find((item) => item.id === post.id)
              ?.media?.flatMap((media) =>
                owns
                  .filter((photo) => photo.image.src === media.image.src)
                  .map((photo) => photo.id),
              ) ?? [],
        }));
        break;
      case "photographs":
        data.photographs = owns.map((photo, index) => ({
          id: photo.id,
          title: photo.title,
          description: photo.description,
          caption: photo.caption,
          width: photo.image.width,
          height: photo.image.height,
          fileStem: `photographs/${String(index + 1).padStart(3, "0")}-${photo.id}`,
          gallery:
            source.state.gallery.find((entry) => entry.photoId === photo.id) ??
            null,
        }));
        data.gallery = base.gallery;
        break;
      case "comments":
        data.interactions = base.interactions.map((row) => ({
          ...row,
          comments: source.interactions[row.postId].comments
            .filter((comment) => comment.author.id === source.viewerId)
            .map((comment) => ({
              id: comment.id,
              body: comment.body,
              createdAt: comment.createdAt,
              editedAt: comment.editedAt,
              deletedAt: comment.deletedAt,
              replyTo: comment.replyTo,
            })),
        }));
        data.postComments = source.state.posts
          .filter(
            (post) =>
              post.author.id === source.viewerId ||
              post.comments.some(
                (comment) => comment.author.id === source.viewerId,
              ),
          )
          .map((post) => ({
            postId: post.id,
            comments: post.comments
              .filter(
                (comment) =>
                  post.author.id === source.viewerId ||
                  comment.author.id === source.viewerId,
              )
              .map((comment) => ({
                id: comment.id,
                author: { id: comment.author.id, name: comment.author.name },
                body: comment.body,
                createdAt: comment.createdAt,
                editedAt: comment.editedAt,
                deletedAt: comment.deletedAt,
                replyTo: comment.replyTo,
              })),
          }));
        break;
      case "friendships":
        data.friendships = source.state.friendships
          .filter((pair) => pair.people.includes(source.viewerId))
          .map((pair) => ({
            ...pair,
            personId: pair.people.find((id) => id !== source.viewerId),
            name: source.state.profiles.find(
              (profile) =>
                profile.person.id ===
                pair.people.find((id) => id !== source.viewerId),
            )?.person.name,
          }));
        break;
      case "messages": {
        const ids = new Set([
          ...source.threads
            .filter((thread) => thread.contact.id !== source.viewerId)
            .map((thread) => thread.id),
          ...Object.keys(source.messageAdditions),
        ]);
        data.messages = [...ids]
          .filter((id) => !conversationId || id === conversationId)
          .map((id) => {
            const thread = source.threads.find((thread) => thread.id === id);
            const contact =
              thread?.contact ??
              source.state.profiles.find((profile) => profile.person.id === id)
                ?.person;
            return {
              id,
              contact: contact
                ? { id: contact.id, name: contact.name }
                : undefined,
              messages: [
                ...(thread?.messages ?? []),
                ...(source.messageAdditions[id] ?? []),
              ],
            };
          });
        break;
      }
      case "notebook":
        data.notebook = [
          ...(source.threads.find(
            (thread) => thread.contact.id === source.viewerId,
          )?.messages ?? []),
          ...source.notebookNotes,
        ];
        break;
      case "drafts":
        data.drafts = {
          post: source.draft,
          messages: source.messageDrafts,
          comments: Object.entries(source.interactions)
            .filter(([, value]) => value.draft)
            .map(([postId, value]) => ({
              postId,
              body: value.draft,
              replyTo: value.replyTo,
            })),
        };
        break;
      case "notifications":
        data.notifications = {
          activity: source.notificationRows.filter(
            (row) => row.recipientId === source.viewerId,
          ),
          readIds: source.notifications.readIds,
          preferences: source.notifications.preferences,
        };
        break;
      case "preferences":
        data.preferences = base.preferences;
        break;
      case "reports":
        data.reports = source.reports;
        break;
    }
  }
  return {
    version: 2,
    scope: "account-preview",
    exportedAt: now.toISOString(),
    included,
    unavailable: [
      "Hosted authentication/session records and server account data are not connected to this preview.",
      "Only available account data can be exported; erased or expired content cannot be reconstructed.",
    ],
    data,
  };
}
