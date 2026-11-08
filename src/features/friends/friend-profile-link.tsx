import Link from "@/components/shared/preview-link";
import { ChevronRight } from "@/components/margin-icons";
import { Avatar } from "@/features/feed/post-content";
import type { Person } from "@/features/feed/schema";
import { FEED_TIME_ZONE } from "@/features/feed/format";

export function FriendProfileLink({
  person,
  username,
  href,
  friendsSince,
  live = false,
}: {
  person: Person;
  username: string;
  href: string;
  friendsSince?: string | null;
  live?: boolean;
}) {
  const parsed = friendsSince ? new Date(friendsSince) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
  return (
    <Link href={href} className="margin-friend-profile-link">
      <span className="margin-friend-person">
        <Avatar live={live} person={person} />
        <span>
          <strong>{person.name}</strong>
          <span>@{username}</span>
        </span>
      </span>
      <span className="margin-friend-since">
        {date ? (
          <>
            Friends since{" "}
            <time
              dateTime={date.toISOString()}
              title={new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
                timeZone: FEED_TIME_ZONE,
              }).format(date)}
            >
              {new Intl.DateTimeFormat("en-GB", {
                month: "long",
                timeZone: FEED_TIME_ZONE,
              }).format(date)}
              {" ’"}
              {new Intl.DateTimeFormat("en-GB", {
                year: "2-digit",
                timeZone: FEED_TIME_ZONE,
              }).format(date)}
            </time>
          </>
        ) : (
          "Friends"
        )}
      </span>
      <ChevronRight className="margin-friend-chevron" aria-hidden="true" />
    </Link>
  );
}
