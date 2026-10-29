import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  AvatarFrame,
  avatarImageStyle,
} from "@/components/shared/avatar-frame";
import type { FeedPost, Person } from "./schema";
import { FEED_TIME_ZONE, postTime } from "./format";
import { PostPhotos } from "./post-photos";
import { PersonLink } from "@/components/shared/person-link";

export function Avatar({
  person,
  small = false,
  sizes,
  linked = false,
  onNavigate,
}: {
  person: Person;
  small?: boolean;
  sizes?: string;
  linked?: boolean;
  onNavigate?: ComponentProps<typeof PersonLink>["onNavigate"];
}) {
  const avatar = (
    <AvatarFrame
      size={small ? 29 : 40}
      className={cn(
        "margin-avatar",
        `margin-avatar-${person.tone}`,
        small && "margin-avatar-small",
      )}
    >
      {person.photo ? (
        <Image
          src={person.photo.src}
          fill
          alt=""
          className="margin-avatar-image"
          sizes={sizes ?? (small ? "29px" : "76px")}
          loading="eager"
          style={avatarImageStyle}
        />
      ) : (
        person.initials
      )}
    </AvatarFrame>
  );
  return linked ? (
    <PersonLink
      person={person}
      className="margin-avatar-link"
      aria-label={`View ${person.name}’s profile`}
      onNavigate={onNavigate}
    >
      {avatar}
    </PersonLink>
  ) : (
    avatar
  );
}

export function PostAuthor({
  post,
  profileDate = false,
}: {
  post: FeedPost;
  profileDate?: boolean;
}) {
  return (
    <header className="margin-post-author">
      <Avatar person={post.author} linked />
      <div>
        <h2 className="margin-person-name" id={`author-${post.id}`}>
          <PersonLink person={post.author}>{post.author.name}</PersonLink>
        </h2>
        <time className="margin-post-time" dateTime={post.createdAt}>
          {profileDate && (
            <span className="margin-profile-card-date">
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "America/Los_Angeles",
              }).format(new Date(post.createdAt))}{" "}
              ·{" "}
            </span>
          )}
          {postTime(post.createdAt)}
        </time>
      </div>
    </header>
  );
}

export function PostContent({
  post,
  highPriority = false,
}: {
  post: FeedPost;
  highPriority?: boolean;
}) {
  return (
    <>
      {post.media && (
        <PostPhotos
          photos={post.media}
          postId={post.id}
          authorName={post.author.name}
          highPriority={highPriority}
        />
      )}
      <div className="margin-post-prose">
        {post.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {post.link && (
        <a
          className="margin-post-link"
          href={post.link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {post.link.title}
          <span> — {new URL(post.link.url).hostname}</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </>
  );
}

/** Shared post details and trailing actions, including flip-animation previews. */
export function PostFooter({
  post,
  profileDate = false,
  actions,
}: {
  post: FeedPost;
  profileDate?: boolean;
  actions?: ReactNode;
}) {
  return (
    <footer className="margin-post-footer">
      {profileDate && (
        <div className="margin-post-details">
          <time className="margin-post-expiry" dateTime={post.expiresAt}>
            Expires{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              timeZone: FEED_TIME_ZONE,
            }).format(new Date(post.expiresAt))}
          </time>
        </div>
      )}
      {actions && (
        <div
          className="margin-post-actions"
          role="group"
          aria-label="Post actions"
        >
          {actions}
        </div>
      )}
    </footer>
  );
}
