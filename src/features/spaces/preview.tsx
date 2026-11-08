"use client";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/shared/preview-link";
import { MarginShell } from "@/components/layout/margin-shell";
import { Avatar } from "@/features/feed/post-content";
import { SpaceClientProvider } from "./client";
import { useSpacesPreview } from "./preview-provider";
import { SpacesList } from "./spaces-list";
import { SpaceDetails } from "./space-details";
import { isSpaceExpired } from "./lifecycle";
import { SpaceTimeline } from "./space-timeline";
import { spaceIsVisible } from "./availability";
export function SpacesPreview({
  beforeNavigation,
}: {
  beforeNavigation?: ReactNode;
}) {
  const { data, client, postsFor, detailsFor, now } = useSpacesPreview();
  const query = useSearchParams();
  const candidate = detailsFor(query.get("space") ?? "");
  const selected =
    candidate && spaceIsVisible(candidate) ? candidate : undefined;
  return (
    <SpaceClientProvider client={client}>
      <MarginShell
        beforeNavigation={beforeNavigation}
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
              spaces: data.spaces
                .filter(
                  (space) =>
                    !isSpaceExpired(space, now) &&
                    space.members.some(
                      (member) => member.userId === data.viewer.id,
                    ),
                )
                .map((space) => ({
                  ...space,
                  memberPreview: (detailsFor(space.id)?.members ?? [])
                    .slice(0, 4)
                    .flatMap((member) => {
                      const person = [data.viewer, ...data.people].find(
                        (p) => p.id === member.userId,
                      );
                      return person ? [person] : [];
                    }),
                })),
              invitations: [],
              nextCursor: null,
            }}
          />
        )}
      </MarginShell>
    </SpaceClientProvider>
  );
}
