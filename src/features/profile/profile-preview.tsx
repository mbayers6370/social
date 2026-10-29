"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Aperture, ChevronRight, Newspaper } from "lucide-react";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { ProfileIdentity } from "./profile-identity";
import { OnRepeat } from "./on-repeat";
import type { ProfilePreviewData } from "./schema";
import { usePreview } from "@/features/local-preview/provider";
import { canReadFriendsPost } from "@/lib/friend-audience";
import { FeedExperience } from "@/features/feed/feed-experience";
import { NewPostButton } from "@/features/compose/new-post-button";
import { ProfileSection } from "./profile-section";

export function ProfilePreview({ profile }: { profile: ProfilePreviewData }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const page = root.current;
    const identity = page?.querySelector<HTMLElement>(
      ".margin-profile-identity",
    );
    if (!page || !identity) return;
    const measure = () =>
      page.style.setProperty(
        "--profile-identity-height",
        `${identity.getBoundingClientRect().height}px`,
      );
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(identity);
    return () => observer.disconnect();
  }, [profile.person.id]);
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
  const gallery = own
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
  const profilePosts = preview.state.posts.filter(
    (post) =>
      post.author.id === current.person.id &&
      Date.parse(post.expiresAt) > preview.now,
  );
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
    <div className="margin-profile" ref={root}>
      <ProfileIdentity
        key={`identity-${current.person.id}`}
        profile={current}
        readOnly={!own}
        onUpdate={preview.updateProfile}
        editRequested={own && preview.profileEditRequested}
        onEditRequestHandled={preview.finishProfileEditRequest}
      />
      <section
        className="margin-profile-posts"
        aria-labelledby="recent-posts-title"
      >
        <div className="margin-profile-posts-card margin-profile-section-card">
          <header className="margin-section-heading">
            <SectionTitle
              id="recent-posts-title"
              tabIndex={-1}
              motif={<SectionMotif icon={Newspaper} />}
            >
              Recent posts
            </SectionTitle>
            {own && <NewPostButton />}
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
      <div className="margin-profile-details">
        {visible && (
          <OnRepeat
            key={`on-repeat-${current.person.id}`}
            own={own}
            tracks={current.onRepeat ?? []}
          />
        )}
        <ProfileSection
          className="margin-profile-gallery"
          aria-labelledby="profile-gallery-title"
        >
          <header className="margin-section-heading">
            <SectionTitle
              id="profile-gallery-title"
              motif={<SectionMotif icon={Aperture} />}
            >
              Gallery
            </SectionTitle>
            <Link href={galleryHref} className="margin-section-link">
              View More
              <ChevronRight aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </header>
          {visible && gallery.length > 0 && (
            <Link
              href={galleryHref}
              className="margin-gallery-preview"
              data-count={Math.min(gallery.length, 3)}
              aria-label={`View all ${gallery.length} photographs`}
            >
              {gallery.slice(0, 3).map((photo, index) => (
                <Image
                  key={photo.image.src}
                  {...photo.image}
                  alt={photo.description}
                  loading="eager"
                  unoptimized={photo.image.src.startsWith("blob:")}
                  sizes={
                    index === 0
                      ? "(max-width: 640px) 60vw, 400px"
                      : "(max-width: 640px) 30vw, 196px"
                  }
                />
              ))}
            </Link>
          )}
        </ProfileSection>
      </div>
    </div>
  );
}
