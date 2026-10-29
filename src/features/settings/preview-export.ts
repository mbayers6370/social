import type { LocalState, Preferences } from "@/features/local-preview/model";
import type { NotificationState } from "@/features/notifications/model";
import type { PreviewState } from "@/features/feed/state";
/** Explicit development DTO. Never serialize the whole provider, credentials or other profiles. */
export function createPreviewExport(
  state: LocalState,
  viewerId: string,
  preferences: Preferences,
  interactions: PreviewState,
  now = new Date(),
  notifications?: NotificationState,
) {
  const profile = state.profiles.find((item) => item.person.id === viewerId);
  return {
    version: 1,
    scope: "local-preview",
    exportedAt: now.toISOString(),
    excludes: [
      "image files",
      "message history and message drafts",
      "unpublished post draft",
      "authentication and server account records",
      "other people’s profiles",
    ],
    profile: profile
      ? {
          name: profile.person.name,
          username: profile.handle,
          bio: profile.bio,
          onRepeat:
            profile.onRepeat?.map((song) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              appleMusicUrl: song.appleMusicUrl,
              spotifyUrl: song.spotifyUrl,
            })) ?? [],
        }
      : null,
    posts: state.posts
      .filter((post) => post.author.id === viewerId)
      .map((post) => ({
        id: post.id,
        createdAt: post.createdAt,
        expiresAt: post.expiresAt,
        text: post.paragraphs,
        audience: post.audience,
        ...(post.link ? { link: post.link.url } : {}),
        ...(post.media
          ? {
              photographDescriptions: post.media.map(
                (photo) => photo.description,
              ),
            }
          : {}),
      })),
    friendships: state.friendships
      .filter(
        ({ people }) => people[0] !== people[1] && people.includes(viewerId),
      )
      .map(({ people, status, requestedBy }) => ({
        personId: people.find((id) => id !== viewerId),
        status,
        ...(status === "pending"
          ? { direction: requestedBy === viewerId ? "sent" : "received" }
          : {}),
      })),
    gallery: state.gallery.flatMap((entry) => {
      const photo = state.photos.find(
        (item) => item.id === entry.photoId && item.ownerId === viewerId,
      );
      return photo
        ? [
            {
              id: photo.id,
              description: photo.description,
              featured: entry.featured,
            },
          ]
        : [];
    }),
    interactions: Object.entries(interactions).map(([postId, value]) => ({
      postId,
      liked: value.liked,
      comments: value.comments
        .filter((comment) => comment.author.id === "local-viewer")
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          replyTo: comment.replyTo,
        })),
    })),
    ...(notifications
      ? {
          notifications: {
            readIds: [...notifications.readIds],
            preferences: { ...notifications.preferences },
          },
        }
      : {}),
    preferences: {
      readingSize: preferences.readingSize,
      motion: preferences.motion,
    },
  };
}
