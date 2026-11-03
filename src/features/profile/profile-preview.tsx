"use client";
import Image from "next/image";
import { Notebook } from "@/components/margin-icons";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { ProfileFrame } from "./profile-frame";
import { ProfileGalleryPreview } from "./profile-gallery-preview";
import { ProfileIdentity } from "./profile-identity";
import { OnRepeat } from "./on-repeat";
import type { ProfilePreviewData } from "./schema";
import { usePreview } from "@/features/local-preview/provider";
import { canReadFriendsPost } from "@/lib/friend-audience";
import { FeedExperience } from "@/features/feed/feed-experience";

export function ProfilePreview({ profile }: { profile: ProfilePreviewData }) {
  const preview = usePreview();
  const current =
    preview.state.profiles.find(
      (item) => item.person.id === profile.person.id,
    ) ?? profile;
  const own = current.person.id === preview.bootstrap.viewerId;
  const visible = canReadFriendsPost(
    preview.bootstrap.viewerId,
    current.person.id,
    preview.state.friendships,
  );
  const gallery = !visible
    ? []
    : own
      ? [...preview.state.gallery]
          .sort((a, b) => Number(b.featured) - Number(a.featured))
          .map((entry) =>
            preview.state.photos.find((photo) => photo.id === entry.photoId)!,
          )
      : current.photos;
  const knownPostIds = new Set(
    [...(preview.bootstrap.posts ?? []), ...preview.state.posts].map(
      (post) => post.id,
    ),
  );
  const profilePosts = visible
    ? preview.state.posts.filter(
        (post) =>
          post.author.id === current.person.id &&
          Date.parse(post.expiresAt) > preview.now,
      )
    : [];
  const recent = visible
    ? current.recent.filter(
        (post) =>
          !knownPostIds.has(post.id) &&
          (!post.createdAt ||
            Date.parse(post.createdAt) + 30 * 86400_000 > preview.now),
      )
    : [];
  const galleryHref = own
    ? "/?view=gallery"
    : `/?view=gallery&person=${encodeURIComponent(current.person.id)}`;
  return (
    <ProfileFrame personId={current.person.id}>
      <ProfileIdentity
        key={`identity-${current.person.id}`}
        profile={current}
        readOnly={!own}
        onUpdate={preview.updateProfile}
        editRequested={own && preview.profileEditRequested}
        onEditRequestHandled={preview.finishProfileEditRequest}
      />
      <div className="margin-profile-details">
        <OnRepeat
          key={`on-repeat-${current.person.id}`}
          own={own}
          tracks={visible ? (current.onRepeat ?? []) : []}
          restricted={!visible}
        />
        <ProfileGalleryPreview
          photos={gallery}
          href={galleryHref}
          visible={visible}
          own={own}
        />
      </div>
      <section
        className="margin-profile-posts"
        aria-labelledby="recent-posts-title"
      >
        <div className="margin-profile-posts-card margin-profile-section-card">
          <header className="margin-section-heading">
            <SectionTitle
              id="recent-posts-title"
              tabIndex={-1}
              motif={<SectionMotif icon={Notebook} />}
            >
              Recent Posts
            </SectionTitle>
          </header>
          {own && (
            <p role="status" className="margin-status">
              {preview.postStatus}
            </p>
          )}
          <div>
            {visible && (
              <FeedExperience
                posts={[]}
                referenceTime={new Date(preview.now).toISOString()}
                renderedPosts={{}}
                profileId={current.person.id}
              />
            )}
            {recent.map((post) => (
              <article key={post.id} className="margin-profile-post">
                <span className="margin-profile-post-date">{post.date}</span>
                <p>{post.body}</p>
                {post.image && (
                  <Image
                    {...post.image.image}
                    alt=""
                    sizes="88px"
                    loading="eager"
                    unoptimized={post.image.image.src.startsWith("blob:")}
                  />
                )}
              </article>
            ))}
          </div>
          {!recent.length && (!visible || !profilePosts.length) && (
            <p className="margin-empty-copy">
              {visible
                ? "No posts here yet."
                : "Posts are shared with friends."}
            </p>
          )}
        </div>
        <p className="margin-profile-note margin-note">
          Posts are designed to disappear after 30 days. Sample expiry only.
        </p>
      </section>
    </ProfileFrame>
  );
}
