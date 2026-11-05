import Link from "next/link";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { SpaceTimeline } from "@/features/spaces/space-timeline";
import type { SpacePostPage } from "@/features/spaces/contracts";
import { EmptyFeedContent } from "@/features/feed/empty-feed";
import { FeedEnd } from "@/features/feed/feed-end";
import { PersonalComposer } from "./personal-composer";

/** Member and founder share this screen. Invitation permissions are enforced
 * separately by the invitation service, never by choosing a different app. */
export function MemberFeed({
  data,
  error,
  older = false,
  referenceTime,
}: {
  data: {
    page: SpacePostPage & { hasFriends: boolean };
    viewer: { id: string; name: string };
  } | null;
  error?: string | null;
  older?: boolean;
  referenceTime: string;
}) {
  return (
    <LiveAppShell active="feed" viewer={data?.viewer}>
      <div className="margin-feed-layout">
        <section className="margin-feed-intro" aria-labelledby="feed-title">
          <h1 id="feed-title" className="sr-only" tabIndex={-1}>
            Feed
          </h1>
          <p className="margin-date">
            <time dateTime={referenceTime}>
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "America/Los_Angeles",
              }).format(new Date(referenceTime))}
            </time>
          </p>
        </section>
        <div className="margin-feed-column margin-feed-surface">
          {data && <PersonalComposer viewer={data.viewer} />}
          {data ? (
            <>
              <SpaceTimeline
                data={data.page}
                viewerId={data.viewer.id}
                href="/app/feed"
              />
              {!data.page.posts.length && !older ? (
                <EmptyFeedContent hasFriends={data.page.hasFriends} />
              ) : null}
              {older && <Link href="/app/feed">Newest posts</Link>}
            </>
          ) : (
            <div role="alert">
              <p>{error ?? "Your feed could not be loaded."}</p>
              <Link href="/app/feed">Try again</Link>
            </div>
          )}
        </div>
        {data &&
          (data.page.posts.length > 0 || older) &&
          !data.page.nextCursor && <FeedEnd />}
      </div>
    </LiveAppShell>
  );
}
