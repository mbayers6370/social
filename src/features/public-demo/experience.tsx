"use client";
import Link from "next/link";
import { flushSync } from "react-dom";
import { DemoExitContext, useDemoExit } from "./session";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import {
  SpacesPreviewProvider,
  useSpacesPreview,
} from "@/features/spaces/preview-provider";
import {
  SpaceClientProvider,
  type SpaceClient,
} from "@/features/spaces/client";
import { MarginShell } from "@/components/layout/margin-shell";
import { Avatar } from "@/features/feed/post-content";
import { FeedExperience } from "@/features/feed/feed-experience";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { TopFriends } from "@/features/profile/top-friends";
import { GalleryPage } from "@/features/gallery/gallery-page";
import { FriendsPage } from "@/features/friends/friends-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { MessagesPreview } from "@/features/messages/messages-preview";
import { SpacesPreview } from "@/features/spaces/preview";
import type { DemoBootstrap } from "@/fixtures/demo";
import { demoTracks } from "@/fixtures/demo-music";
import { previewHref } from "@/lib/public-demo";
import { friendStatus } from "@/features/friends/model";

const initialTopIds = ["theo", "june", "samuel", "mara"];

const localCatalog: typeof fetch = async (input, init) => {
  const url = new URL(String(input), "https://demo.invalid");
  if (
    url.pathname !== "/api/development/events" ||
    (init?.method ?? "GET") !== "GET"
  )
    throw new Error("Unexpected event request in the fictional demo.");
  return Response.json({
    events: [],
    nextPage: null,
    notice:
      "The portfolio uses fictional Spaces. Live event search is not connected.",
  });
};

export function DemoExperience({ bootstrap }: { bootstrap: DemoBootstrap }) {
  const [active, setActive] = useState(true);
  const exit = useCallback(() => {
    // Unmount every provider, draft and message before leaving the document.
    flushSync(() => setActive(false));
    window.location.replace("/");
  }, []);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      // Browser history must not resurrect an old in-memory demo session.
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  const loadFriend = useCallback(
    async (id: string) =>
      id === "nadia" ? structuredClone(bootstrap.nadia) : null,
    [bootstrap.nadia],
  );
  if (!active) return null;
  return (
    <DemoExitContext.Provider value={exit}>
      <PreviewProvider
        bootstrap={bootstrap.social}
        loadFriendProfileAction={loadFriend}
        fixedClock
      >
        <SpacesPreviewProvider
          bootstrap={bootstrap.spaces}
          catalogRequest={localCatalog}
          mapHref={previewHref}
        >
          <DemoSession />
        </SpacesPreviewProvider>
      </PreviewProvider>
    </DemoExitContext.Provider>
  );
}
function DemoSession() {
  const exit = useDemoExit();
  const preview = usePreview();
  const spaces = useSpacesPreview();
  const selected = useRef(initialTopIds);
  const [topIds, setTopIds] = useState(initialTopIds);
  const [networkError, setNetworkError] = useState("");
  useEffect(() => {
    const denied = (event: Event) =>
      setNetworkError((event as CustomEvent<string>).detail);
    window.addEventListener("margin:demo-network-denied", denied);
    return () =>
      window.removeEventListener("margin:demo-network-denied", denied);
  }, []);
  const client = useMemo<SpaceClient>(
    () => ({
      ...spaces.client,
      request: async (href, init) => {
        const url = new URL(href, "https://demo.invalid");
        const method = init?.method ?? "GET";
        if (url.pathname === "/api/development/music" && method === "GET") {
          const q = (url.searchParams.get("q") ?? "").toLowerCase();
          return Response.json({
            tracks: demoTracks.filter((t) =>
              `${t.title} ${t.artist}`.toLowerCase().includes(q),
            ),
          });
        }
        if (
          url.pathname === "/api/development/music/selections" &&
          method === "POST"
        ) {
          const body = JSON.parse(String(init?.body));
          const track = demoTracks.find((t) => t.id === body.trackId);
          if (!track || !["add", "remove"].includes(body.action))
            return Response.json(
              { error: "Choose a sample song." },
              { status: 400 },
            );
          const tracks = body.action === "remove" ? [] : [track];
          return Response.json({ tracks });
        }
        if (url.pathname === "/api/profiles/me/top-friends") {
          const friends = preview.state.profiles.filter(
            (p) =>
              friendStatus(
                preview.bootstrap.viewerId,
                p.person.id,
                preview.state.friendships,
              ) === "friends",
          );
          if (method === "PUT") {
            const { friendIds } = JSON.parse(String(init?.body));
            if (
              !Array.isArray(friendIds) ||
              friendIds.length > 4 ||
              new Set(friendIds).size !== friendIds.length ||
              !friendIds.every((id) => friends.some((p) => p.person.id === id))
            )
              return Response.json(
                { error: "Choose up to four fictional friends." },
                { status: 400 },
              );
            selected.current = friendIds;
            setTopIds(friendIds);
          } else if (method !== "GET")
            throw Error("Unexpected Top Four demo operation.");
          const q = (url.searchParams.get("q") ?? "").toLowerCase();
          return Response.json({
            selected: selected.current.flatMap((id) =>
              friends.filter((p) => p.person.id === id).map((p) => p.person),
            ),
            contacts: friends
              .filter((p) =>
                `${p.person.name} ${p.handle}`.toLowerCase().includes(q),
              )
              .map((p) => ({ person: p.person })),
            nextCursor: null,
          });
        }
        return spaces.client.request(href, init);
      },
    }),
    [spaces.client, preview],
  );
  const notice = (
    <>
      <aside
        className="margin-demo-notice"
        aria-label="Interactive demonstration"
      >
        <span>
          Interactive demo · Fictional accounts · Changes stay in this tab and
          reset on refresh.
        </span>
        <Link
          href="/"
          onClick={(event) => {
            event.preventDefault();
            exit?.();
          }}
        >
          Back to Margin
        </Link>
      </aside>
      {networkError && (
        <p className="margin-demo-error" role="alert">
          {networkError}
        </p>
      )}
    </>
  );
  return (
    <SpaceClientProvider client={client}>
      <DemoScreen topIds={topIds} notice={notice} />
    </SpaceClientProvider>
  );
}
function DemoScreen({
  topIds,
  notice,
}: {
  topIds: string[];
  notice: ReactNode;
}) {
  const query = useSearchParams();
  const preview = usePreview();
  const view = query.get("view") ?? "feed";
  const target = query.get("person") ?? preview.bootstrap.viewerId;
  const viewer = preview.state.profiles.find(
    (p) => p.person.id === preview.bootstrap.viewerId,
  )!;
  if (view === "spaces") return <SpacesPreview beforeNavigation={notice} />;
  const profile = preview.state.profiles.find(
    (p) => p.person.id === target || p.handle === target,
  );
  const own = profile?.person.id === preview.bootstrap.viewerId;
  const friends = topIds.flatMap((id) =>
    preview.state.profiles
      .filter(
        (p) =>
          p.person.id === id &&
          friendStatus(
            preview.bootstrap.viewerId,
            id,
            preview.state.friendships,
          ) === "friends",
      )
      .map((p) => p.person),
  );
  return (
    <MarginShell
      beforeNavigation={notice}
      active={
        view === "messages"
          ? "messages"
          : ["profile", "gallery", "friends", "settings"].includes(view)
            ? "profile"
            : "feed"
      }
      profileAvatar={<Avatar person={viewer.person} />}
    >
      {view === "profile" ? (
        profile ? (
          <ProfilePreview
            key={profile.person.id}
            profile={profile}
            topFriends={
              own ||
              friendStatus(
                preview.bootstrap.viewerId,
                profile.person.id,
                preview.state.friendships,
              ) === "friends" ? (
                <TopFriends
                  key={profile.person.id}
                  own={own}
                  friends={friends.filter((p) => p.id !== profile.person.id)}
                />
              ) : undefined
            }
          />
        ) : (
          <p role="status">This fictional profile is unavailable.</p>
        )
      ) : view === "gallery" ? (
        <GalleryPage key={target} personId={target} />
      ) : view === "friends" ? (
        <FriendsPage />
      ) : view === "settings" ? (
        <SettingsPage />
      ) : view === "messages" ? (
        <MessagesPreview threads={preview.threads} />
      ) : (
        <FeedExperience
          posts={[]}
          renderedPosts={{}}
          referenceTime={preview.bootstrap.now}
        />
      )}
    </MarginShell>
  );
}
