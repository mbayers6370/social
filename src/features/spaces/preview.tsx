"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MarginShell } from "@/components/layout/margin-shell";
import { Avatar } from "@/features/feed/post-content";
import { SpaceClientProvider } from "./client";
import { useSpacesPreview } from "./preview-provider";
import { SpacesList } from "./spaces-list";
import { SpaceDetails } from "./space-details";
import { isSpaceExpired } from "./lifecycle";
import { SpaceTimeline } from "./space-timeline";
export function SpacesPreview() {
  const { data, client, postsFor, detailsFor, now } = useSpacesPreview();
  const query = useSearchParams();
  const selected = detailsFor(query.get("space") ?? "");
  return (
    <SpaceClientProvider client={client}>
      <MarginShell
        active="spaces"
        profileAvatar={<Avatar person={data.viewer} />}
      >
        {selected ? (
          <SpaceDetails
            key={selected.id}
            data={selected}
            viewer={data.viewer}
            hasPosts={postsFor(selected.id).length > 0}
          >
            <SpaceTimeline
              data={{ posts: postsFor(selected.id), nextCursor: null }}
              href={`/app/spaces/${selected.id}`}
              viewerId={data.viewer.id}
            />
          </SpaceDetails>
        ) : query.has("space") ? (
          <section className="margin-spaces-page">
            <p>This sample Space is unavailable.</p>
            <Link href="/preview/spaces">All Spaces</Link>
          </section>
        ) : (
          <SpacesList
            data={{
              spaces: data.spaces.filter(
                (space) =>
                  !isSpaceExpired(space, now) &&
                  space.members.some(
                    (member) => member.userId === data.viewer.id,
                  ),
              ),
              invitations: [],
              nextCursor: null,
            }}
          />
        )}
      </MarginShell>
    </SpaceClientProvider>
  );
}
