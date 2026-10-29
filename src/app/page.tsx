import { PublicShell } from "@/features/public-site/public-shell";
import type { Viewport } from "next";
import { PublicHome } from "@/features/public-site/public-home";
import { notFound } from "next/navigation";
import { MarginShell } from "@/components/layout/margin-shell";
import { FeedExperience } from "@/features/feed/feed-experience";
import { Avatar, PostAuthor, PostContent } from "@/features/feed/post-content";
import { chronologicalPosts } from "@/features/feed/format";

export const viewport: Viewport = {
  viewportFit: process.env.NODE_ENV === "development" ? "cover" : "auto",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    person?: string | string[];
  }>;
}) {
  if (process.env.NODE_ENV === "development") {
    const { view, person } = await searchParams;
    if (view === "friends") {
      const { FriendsPage } = await import("@/features/friends/friends-page");
      const { getDevelopmentScreens } =
        await import("@/server/fixtures/screens");
      return (
        <MarginShell
          active="profile"
          profileAvatar={
            <Avatar person={getDevelopmentScreens().profile.person} />
          }
        >
          <FriendsPage />
        </MarginShell>
      );
    }
    if (view === "settings") {
      const { SettingsPage } =
        await import("@/features/settings/settings-page");
      const { getDevelopmentScreens } =
        await import("@/server/fixtures/screens");
      return (
        <MarginShell
          active="profile"
          profileAvatar={
            <Avatar person={getDevelopmentScreens().profile.person} />
          }
        >
          <SettingsPage />
        </MarginShell>
      );
    }
    if (view === "gallery") {
      const { GalleryPage } = await import("@/features/gallery/gallery-page");
      const { getDevelopmentScreens } =
        await import("@/server/fixtures/screens");
      const { profile } = getDevelopmentScreens();
      return (
        <MarginShell
          active="profile"
          profileAvatar={<Avatar person={profile.person} />}
        >
          <GalleryPage
            key={typeof person === "string" ? person : "viewer"}
            personId={typeof person === "string" ? person : undefined}
          />
        </MarginShell>
      );
    }
    if (view === "messages" || view === "profile") {
      const { getDevelopmentScreens } =
        await import("@/server/fixtures/screens");
      const { threads, profile } = getDevelopmentScreens();
      if (view === "messages") {
        const { MessagesPreview } =
          await import("@/features/messages/messages-preview");
        return (
          <MarginShell
            active="messages"
            profileAvatar={<Avatar person={profile.person} />}
          >
            <MessagesPreview threads={threads} />
          </MarginShell>
        );
      }
      const { ProfilePreview } =
        await import("@/features/profile/profile-preview");
      const { getDevelopmentSocial } = await import("@/server/fixtures/social");
      const target =
        typeof person === "string"
          ? getDevelopmentSocial().profiles.find(
              (item) => item.person.id === person,
            )
          : profile;
      if (!target) return notFound();
      return (
        <MarginShell
          active="profile"
          profileAvatar={<Avatar person={profile.person} />}
        >
          <ProfilePreview key={target.person.id} profile={target} />
        </MarginShell>
      );
    }
    const { getDevelopmentFeed } = await import("@/server/fixtures/feed");
    const { posts, referenceTime } = getDevelopmentFeed();
    const { getDevelopmentScreens } = await import("@/server/fixtures/screens");
    const viewer = getDevelopmentScreens().profile.person;
    const feedPosts = posts.filter((post) => post.author.id !== viewer.id);
    const firstPhotoId = chronologicalPosts(feedPosts).find(
      (post) => post.media,
    )?.id;
    return (
      <MarginShell profileAvatar={<Avatar person={viewer} />}>
        <FeedExperience
          posts={[]}
          referenceTime={referenceTime}
          renderedPosts={Object.fromEntries(
            feedPosts.map((post) => [
              post.id,
              <div key={post.id}>
                <PostAuthor post={post} />
                <PostContent
                  post={post}
                  highPriority={post.id === firstPhotoId}
                />
              </div>,
            ]),
          )}
        />
      </MarginShell>
    );
  }
  return (
    <PublicShell>
      <PublicHome />
    </PublicShell>
  );
}
