"use client";
import { createLocalId } from "@/lib/local-id";
import { spaceInvitationSearch } from "./schema";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Person } from "@/features/feed/schema";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { assertStillPhoto } from "@/lib/media-policy";
import { DAILY_IMAGES, SPACE_PHOTO_LIMIT } from "@/lib/platform-rules";
import {
  spaceInput,
  spacePostInput,
  spacePostDraftInput,
  commentInput,
  memberInput,
  eventJoinInput,
} from "./schema";
import type {
  SpaceDetails as Details,
  SpacePost,
  SpaceComments,
} from "./contracts";
import type { SpaceClient } from "./client";
import { visibleSpacePosts, visibleSpaceDetails } from "./preview-selectors";
import { spaceIsVisible } from "./availability";
import { createSpacePreviewReport } from "./preview-report";
import { eventSearchInput, matchesEventSearch } from "./event-discovery";
import {
  eventExpiry,
  isSpaceExpired,
  defaultEventEnd,
  validEventEnd,
  privateSpaceStorageKind,
} from "./lifecycle";
import type { CatalogEvent } from "./contracts";
import type { SafetyReport } from "@/features/safety/model";
type PreviewPhoto = SpacePost["photos"][number] & {
  ownerId: string;
  src: string;
};
export type SpacesPreviewData = {
  now: number;
  viewer: Person;
  people: Person[];
  spaces: Details[];
  posts: SpacePost[];
  photos: PreviewPhoto[];
  comments: Record<string, SpaceComments["comments"]>;
};
function joinPreviewEvent(data: SpacesPreviewData, room: Details) {
  if (isSpaceExpired(room, Date.now()))
    throw Error("This Event Space has expired.");
  if (room.kind !== "EVENT") throw Error("That Event Space is unavailable.");
  if (room.members.some((member) => member.userId === data.viewer.id))
    return { id: room.id };
  if (room.archivedAt)
    throw Error("That event already exists and is archived.");
  room.members.push({
    userId: data.viewer.id,
    name: data.viewer.name,
    role: "MEMBER",
    rsvp: null,
  });
  room.memberCount = room.members.length;
  room.role = "MEMBER";
  room.includeInFeed = false;
  room.rsvp = null;
  return { id: room.id };
}
type PreviewSession = {
  now: number;
  reports: SafetyReport[];
  data: SpacesPreviewData;
  client: SpaceClient;
  feedPosts: SpacePost[];
  postsFor: (id: string) => SpacePost[];
  detailsFor: (id: string) => Details | undefined;
};
const Context = createContext<PreviewSession | null>(null);
export const useOptionalSpacesPreview = () => useContext(Context);
export function useSpacesPreview() {
  const value = useOptionalSpacesPreview();
  if (!value) throw Error("Spaces preview requires its development provider.");
  return value;
}
/** Fictional data is shared across preview routes; live HTTP clients never consume this session. */
export function SpacesPreviewProvider({
  bootstrap,
  children,
  catalogRequest = fetch,
  mapHref,
}: {
  catalogRequest?: typeof fetch;
  mapHref?: (href: string) => string;
  bootstrap: SpacesPreviewData;
  children: ReactNode;
}) {
  const preview = useOptionalPreview();
  const [data, setData] = useState(bootstrap);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const current = useRef(data);
  const urls = useRef<string[]>([]);
  const uploads = useRef(0);
  const writing = useRef(false);
  const request = useCallback<SpaceClient["request"]>(
    async (url, init) => {
      const response = (value: unknown = {}, status = 200) =>
        Response.json(value, { status });
      const mutation = init?.method && init.method !== "GET";
      if (mutation && writing.current)
        return response(
          { error: "Wait for the current preview change to finish." },
          409,
        );
      if (mutation) writing.current = true;
      try {
        const next = structuredClone(current.current);
        const path = new URL(url, "https://preview.invalid").pathname;
        const method = init?.method ?? "GET";
        const body =
          typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const segments = path.split("/").filter(Boolean);
        const id = segments[2];
        const room = next.spaces.find((s) => s.id === id);
        let result: object = {};
        if (path === "/api/spaces/events" && method === "GET") {
          const query = new URL(url, "https://preview.invalid").searchParams;
          const search = eventSearchInput.parse(query.get("q") ?? "");
          const before = query.get("before");
          const providerPage = before?.startsWith("tm-")
            ? Number(before.slice(3))
            : 0;
          const now = preview?.now ?? Date.now();
          const local = next.spaces.filter(
            (space) =>
              space.kind === "EVENT" &&
              !space.archivedAt &&
              !isSpaceExpired(space, now) &&
              matchesEventSearch(space, search),
          );
          let events: CatalogEvent[] = [];
          let nextPage: number | null = null;
          let notice: string | undefined;
          try {
            const fetched = await catalogRequest(
              `/api/development/events?${new URLSearchParams({ q: search, page: String(providerPage) })}`,
              {
                headers: { "x-margin-preview": "1" },
                signal: init?.signal ?? undefined,
              },
            );
            if (!fetched.ok) throw Error("Event search unavailable");
            const found = await fetched.json();
            events = found.events;
            nextPage = found.nextPage;
          } catch {
            notice =
              "Ticketmaster search is temporarily unavailable. You can still open your joined Spaces above.";
          }
          const mapped = events.flatMap((event) => {
            const space = next.spaces.find(
              (s) => s.ticketmasterId === event.id,
            );
            if (space && (space.archivedAt || isSpaceExpired(space, now)))
              return [];
            return [
              {
                ...event,
                endsAt:
                  space?.endsAt ??
                  defaultEventEnd(event.startsAt).toISOString(),
                id: space?.id ?? event.id,
                ticketmasterId: event.id,
                kind: "EVENT" as const,
                archivedAt: null,
                memberCount: space?.memberCount ?? 0,
                isMember:
                  space?.members.some((m) => m.userId === next.viewer.id) ??
                  false,
                expiresAt:
                  space?.expiresAt ??
                  eventExpiry(defaultEventEnd(event.startsAt)).toISOString(),
              },
            ];
          });
          const existing = local.map((space) => ({
            id: space.id,
            name: space.name,
            kind: space.kind,
            startsAt: space.startsAt,
            endsAt: space.endsAt,
            timeZone: space.timeZone,
            location: space.location,
            archivedAt: null,
            expiresAt: space.expiresAt,
            imageUrl: space.imageUrl,
            sourceUrl: space.sourceUrl,
            ticketmasterId: space.ticketmasterId,
            memberCount: space.memberCount,
            isMember: space.members.some((m) => m.userId === next.viewer.id),
          }));
          return response({
            events: [
              ...new Map(
                [...existing, ...mapped].map((e) => [
                  e.ticketmasterId ?? e.id,
                  e,
                ]),
              ).values(),
            ],
            nextCursor: nextPage === null ? null : `tm-${nextPage}`,
            ...(notice ? { notice } : {}),
          });
        } else if (
          segments[1] === "spaces" &&
          segments[2] === "events" &&
          segments[4] === "join" &&
          method === "POST"
        ) {
          eventJoinInput.parse(body);
          const providerId = segments[3];
          const existing = next.spaces.find(
            (space) => space.ticketmasterId === providerId,
          );
          if (existing) result = joinPreviewEvent(next, existing);
          else {
            const fetched = await catalogRequest(
              `/api/development/events?id=${encodeURIComponent(providerId)}`,
              { headers: { "x-margin-preview": "1" } },
            );
            if (!fetched.ok)
              throw Error("This event could not be loaded. Please try again.");
            const { event }: { event: CatalogEvent } = await fetched.json();
            const endsAt = defaultEventEnd(event.startsAt).toISOString();
            const expiresAt = eventExpiry(endsAt).toISOString();
            if (Date.parse(expiresAt) <= (preview?.now ?? Date.now()))
              throw Error("This Event Space has expired.");
            const id = `ticketmaster-${event.id}`;
            next.spaces.push({
              ...event,
              id,
              ticketmasterId: event.id,
              kind: "EVENT",
              endsAt,
              expiresAt,
              archivedAt: null,
              creatorId: next.viewer.id,
              viewerId: next.viewer.id,
              role: "MEMBER",
              includeInFeed: false,
              rsvp: null,
              memberCount: 1,
              members: [
                {
                  userId: next.viewer.id,
                  name: next.viewer.name,
                  role: "MEMBER",
                  rsvp: null,
                },
              ],
              blockedMembers: [],
            });
            result = { id };
          }
        } else if (path === "/api/reports" && method === "POST") {
          const report = createSpacePreviewReport(
            next,
            preview?.state.friendships ?? [],
            preview?.now ?? next.now,
            body,
          );
          setReports((current) => [...current, report]);
          return response({ id: report.id }, 201);
        } else if (path === "/api/spaces" && method === "POST") {
          const input = spaceInput.parse(body);
          const id = `preview-${createLocalId()}`;
          next.spaces.push({
            id,
            name: input.name,
            kind: privateSpaceStorageKind(input.startsAt),
            startsAt: input.startsAt ?? null,
            timeZone: input.timeZone ?? null,
            location: input.location || null,
            endsAt: input.endsAt ?? null,
            rsvpEnabled: input.rsvpEnabled ?? true,
            archivedAt: null,
            memberCount: 1,
            creatorId: next.viewer.id,
            viewerId: next.viewer.id,
            role: "ADMIN",
            includeInFeed: false,
            rsvp: null,
            members: [
              {
                userId: next.viewer.id,
                name: next.viewer.name,
                role: "ADMIN",
                rsvp: null,
              },
            ],
            blockedMembers: [],
          });
          result = { id };
        } else if (segments[1] === "posts" && segments[3] === "comments") {
          const post = next.posts.find((p) => p.id === id);
          if (!post) throw Error("That sample post is unavailable.");
          const space = next.spaces.find((s) => s.id === post.space?.id)!;
          if (method === "GET")
            return response({
              comments: (next.comments[id] ?? []).filter(
                (c) =>
                  !preview?.state.friendships.some(
                    (r) =>
                      r.status === "blocked" &&
                      r.people.includes(next.viewer.id) &&
                      r.people.includes(c.author.id),
                  ),
              ),
              nextCursor: null,
              readOnly: Boolean(space.archivedAt),
              viewer: next.viewer,
            });
          if (isSpaceExpired(space, preview?.now ?? Date.now()))
            throw Error("This Event Space has expired.");
          if (space.archivedAt)
            throw Error("This Space is archived and read-only.");
          const input = commentInput.parse(body);
          const comment = {
            id: `preview-${createLocalId()}`,
            body: input.body,
            createdAt: new Date(preview?.now ?? Date.now()).toISOString(),
            author: next.viewer,
            ...(input.replyTo ? { replyTo: input.replyTo } : {}),
          };
          next.comments[id] = [...(next.comments[id] ?? []), comment];
          result = { id: comment.id };
        } else if (path === "/api/relationships" && method === "POST") {
          const person = next.people.find((p) => p.id === body.targetId);
          if (!person) throw Error("Use one of the sample members.");
          if (!preview)
            throw Error("The personal preview session is unavailable.");
          await preview.changeFriend(person.id, body.action);
        } else if (segments[1] === "posts" && method === "DELETE") {
          const post = next.posts.find((post) => post.id === id);
          if (!post || post.author.id !== next.viewer.id)
            throw Error("This post is unavailable.");
          if (body.deletePhotos === true) {
            const ids = new Set(
              next.photos
                .filter(
                  (photo) =>
                    photo.ownerId === next.viewer.id &&
                    post.photos.some((attached) => attached.id === photo.id),
                )
                .map((photo) => photo.id),
            );
            next.photos = next.photos.filter((photo) => !ids.has(photo.id));
            next.posts = next.posts.map((post) => ({
              ...post,
              photos: post.photos.filter((photo) => !ids.has(photo.id)),
            }));
          }
          next.posts = next.posts.filter((p) => p.id !== id);
          delete next.comments[id];
        } else if (room) {
          if (isSpaceExpired(room, preview?.now ?? Date.now()))
            throw Error("This Event Space has expired.");
          if (
            room.archivedAt &&
            method !== "GET" &&
            method !== "DELETE" &&
            !(
              segments[3] === "members" &&
              (body.action === "preferences" ||
                (body.action === "remove" && body.userId === next.viewer.id))
            )
          )
            throw Error("This Space is archived and read-only.");
          if (segments[3] === "schedule" && method === "PATCH") {
            if (room.kind !== "EVENT" || room.role !== "ADMIN")
              throw Error("Space administrator access required.");
            if (!validEventEnd(room.startsAt!, body.endsAt))
              throw Error(
                "Choose an end time after the start and within 30 days.",
              );
            const expiresAt = eventExpiry(body.endsAt).toISOString();
            if (Date.parse(expiresAt) <= (preview?.now ?? Date.now()))
              throw Error("This Space would already be expired.");
            room.endsAt = body.endsAt;
            room.expiresAt = expiresAt;
            for (const post of next.posts.filter(
              (post) => post.space?.id === room.id,
            ))
              post.expiresAt = new Date(
                Math.min(
                  Date.parse(post.createdAt) + 30 * 86400_000,
                  Date.parse(expiresAt),
                ),
              ).toISOString();
          } else if (segments[3] === "join" && method === "POST") {
            result = joinPreviewEvent(next, room);
          } else if (method === "DELETE" && segments.length === 3) {
            if (room.kind === "EVENT")
              throw Error(
                "Public Event Spaces close through scheduled expiry.",
              );
            next.spaces = next.spaces.filter((s) => s.id !== id);
            for (const p of next.posts.filter((p) => p.space?.id === id))
              delete next.comments[p.id];
            next.posts = next.posts.filter((p) => p.space?.id !== id);
          } else if (method === "PATCH" && segments.length === 3) {
            if (room.role !== "ADMIN")
              throw Error("Space administrator access required.");
            const input = spaceInput.parse(body);
            if (room.kind === "EVENT")
              throw Error(
                "Event details come from Ticketmaster and cannot be changed here.",
              );
            room.name = input.name;
            room.kind = privateSpaceStorageKind(input.startsAt);
            room.startsAt = input.startsAt ?? null;
            room.timeZone = input.timeZone ?? null;
            room.location = input.location || null;
            room.endsAt = input.endsAt ?? null;
            room.rsvpEnabled = input.rsvpEnabled ?? room.rsvpEnabled ?? true;
            if (!input.startsAt) {
              room.rsvp = null;
              room.members.forEach((member) => {
                member.rsvp = null;
              });
            }
            for (const post of next.posts.filter((p) => p.space?.id === id))
              post.space!.name = input.name;
          } else if (segments[3] === "archive" && method === "POST") {
            if (room.kind === "EVENT")
              throw Error("Event Spaces close automatically.");
            room.archivedAt = new Date(
              preview?.now ?? Date.now(),
            ).toISOString();
            for (const post of next.posts.filter((p) => p.space?.id === id))
              post.space!.archived = true;
          } else if (segments[3] === "members" && method === "PATCH") {
            const input = memberInput.parse(body);
            if (input.action === "preferences")
              room.includeInFeed = input.includeInFeed;
            else if (input.action === "rsvp-settings") {
              if (room.role !== "ADMIN")
                throw Error("Space administrator access required.");
              room.rsvpEnabled = input.rsvpEnabled;
            } else if (input.action === "rsvp") {
              if (room.rsvpEnabled === false)
                throw Error("RSVPs are turned off for this Space.");
              if (!room.startsAt)
                throw Error("Add a date to this Space before using RSVP");
              room.rsvp = input.rsvp;
              room.members.find((m) => m.userId === next.viewer.id)!.rsvp =
                input.rsvp;
            } else if (input.action === "role") {
              if (room.kind === "EVENT")
                throw Error(
                  "Only a founder can assign Event Space administrators.",
                );
              const member = room.members.find(
                (m) => m.userId === input.userId,
              );
              if (member) member.role = input.role;
            } else {
              const leaving = input.userId === next.viewer.id;
              if (input.userId === room.creatorId && !leaving)
                throw Error("The creator must remain a Space administrator.");
              if (
                leaving &&
                room.members.length === 1 &&
                room.kind !== "EVENT"
              ) {
                next.spaces = next.spaces.filter(
                  (space) => space.id !== room.id,
                );
                for (const post of next.posts.filter(
                  (post) => post.space?.id === room.id,
                ))
                  delete next.comments[post.id];
                next.posts = next.posts.filter(
                  (post) => post.space?.id !== room.id,
                );
              }
              if (
                leaving &&
                room.kind !== "EVENT" &&
                room.creatorId === next.viewer.id
              ) {
                const others = room.members.filter(
                  (member) => member.userId !== next.viewer.id,
                );
                const successor =
                  others.find((member) => member.role === "ADMIN") ?? others[0];
                if (successor) {
                  successor.role = "ADMIN";
                  room.creatorId = successor.userId;
                }
              }
              room.members = room.members.filter(
                (m) => m.userId !== input.userId,
              );
              room.blockedMembers = room.blockedMembers.filter(
                (m) => m.id !== input.userId,
              );
              room.memberCount = room.members.length;
              if (input.userId === next.viewer.id) room.includeInFeed = false;
            }
          } else if (segments[3] === "invitations" && method === "GET") {
            if (room.role !== "ADMIN" || room.archivedAt)
              throw Error("Space administrator access required.");
            const term = spaceInvitationSearch
              .parse(
                new URL(url, "https://preview.invalid").searchParams.get("q") ??
                  "",
              )
              .toLowerCase();
            const profiles = preview?.state.profiles ?? [];
            const relations = preview?.state.friendships ?? [];
            const candidates = next.people
              .filter(
                (person) =>
                  person.id !== next.viewer.id &&
                  !room.members.some((member) => member.userId === person.id),
              )
              .filter(
                (person) =>
                  !relations.some(
                    (pair) =>
                      pair.status === "blocked" &&
                      pair.people.includes(next.viewer.id) &&
                      pair.people.includes(person.id),
                  ),
              )
              .map((person) => ({
                person,
                username:
                  profiles.find((profile) => profile.person.id === person.id)
                    ?.handle ?? person.id,
                friend: relations.some(
                  (pair) =>
                    pair.status === "accepted" &&
                    pair.people.includes(next.viewer.id) &&
                    pair.people.includes(person.id),
                ),
              }))
              .filter(
                (member) =>
                  member.friend &&
                  (term
                    ? `${member.person.name} ${member.username}`
                        .toLowerCase()
                        .includes(term)
                    : true),
              )
              .sort(
                (a, b) =>
                  Number(b.friend) - Number(a.friend) ||
                  a.person.name.localeCompare(b.person.name),
              );
            return response({
              members: candidates.slice(0, 20),
              hasMore: candidates.length > 20,
            });
          } else if (segments[3] === "invitations" && method === "POST") {
            if (
              room.role !== "ADMIN" ||
              !preview?.state.friendships.some(
                (pair) =>
                  pair.status === "accepted" &&
                  pair.people.includes(next.viewer.id) &&
                  pair.people.includes(body.targetId),
              )
            )
              throw Error("Space invitations require an accepted friendship.");
            if (!next.people.some((p) => p.id === body.targetId))
              throw Error(
                "Choose one of the sample members. No real invitation will be sent.",
              );
            result = { id: `preview-${createLocalId()}` };
          } else if (segments[3] === "photos" && method === "GET") {
            return response({
              photos: next.photos.filter((p) => p.ownerId === next.viewer.id),
              nextCursor: null,
            });
          } else if (
            (segments[3] === "posts" || segments[3] === "photos") &&
            method === "POST"
          ) {
            const retained = new Set(
              next.posts
                .filter((p) => p.space?.id === id)
                .flatMap((p) => p.photos.map((p) => p.id)),
            );
            let content: { body: string; photoIds: string[] };
            let incoming: { file: File }[] = [];
            if (init?.body instanceof FormData) {
              const input = init.body.get("input");
              if (typeof input !== "string") throw Error("Invalid post.");
              content = spacePostDraftInput.parse(JSON.parse(input));
              incoming = init.body.getAll("photos").map((file) => {
                if (!(file instanceof File)) throw Error("Invalid photograph.");
                return { file };
              });
              if (
                !incoming.length ||
                incoming.length + content.photoIds.length > 3
              )
                throw Error("Choose up to three photographs.");
            } else if (init?.body instanceof File) {
              content = { body: "", photoIds: [] };
              incoming = [{ file: init.body }];
            } else content = spacePostInput.parse(body);
            if (uploads.current + incoming.length > DAILY_IMAGES)
              throw Error(
                "The preview's three new photograph uploads have been used. Reload to reset this sample session.",
              );
            for (const { file } of incoming) {
              if (retained.size + incoming.length > SPACE_PHOTO_LIMIT)
                throw Error("This sample Space already holds 20 photographs.");
              assertStillPhoto(
                new Uint8Array(await file.arrayBuffer()),
                file.type,
                file.name,
              );
              const src = URL.createObjectURL(file);
              const image = new window.Image();
              image.src = src;
              try {
                await image.decode();
              } catch {
                URL.revokeObjectURL(src);
                throw Error("That photograph could not be decoded.");
              }
              urls.current.push(src);
              const photoId = `preview-${createLocalId()}`;
              next.photos.push({
                id: photoId,
                description: "Photograph",
                width: image.naturalWidth,
                height: image.naturalHeight,
                ownerId: next.viewer.id,
                src,
              });
              content.photoIds.push(photoId);
            }
            content = spacePostInput.parse(content);
            const photos = content.photoIds.map((id) => {
              const photo = next.photos.find(
                (p) => p.id === id && p.ownerId === next.viewer.id,
              );
              if (!photo) throw Error("Choose one of your sample photographs.");
              return photo;
            });
            if (
              new Set([...retained, ...content.photoIds]).size >
              SPACE_PHOTO_LIMIT
            )
              throw Error("This sample Space already holds 20 photographs.");
            const createdAt = new Date(preview?.now ?? Date.now());
            const post = {
              id: `preview-${createLocalId()}`,
              body: content.body,
              createdAt: createdAt.toISOString(),
              expiresAt: new Date(
                createdAt.getTime() + 30 * 86400_000,
              ).toISOString(),
              author: next.viewer,
              space: { id: room.id, name: room.name, archived: false },
              photos,
            };
            if (room.expiresAt)
              post.expiresAt = new Date(
                Math.min(
                  Date.parse(post.expiresAt),
                  Date.parse(room.expiresAt),
                ),
              ).toISOString();
            next.posts.unshift(post);
            result = { id: post.id };
            uploads.current += incoming.length;
          } else throw Error("That action isn't part of this local preview.");
        } else throw Error("That sample Space is unavailable.");
        current.current = next;
        setData(next);
        return response(result);
      } catch (error) {
        return response(
          {
            error:
              error instanceof Error
                ? error.message
                : "Couldn’t change the sample.",
          },
          400,
        );
      } finally {
        if (mutation) writing.current = false;
      }
    },
    [preview, catalogRequest],
  );
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const client = useMemo<SpaceClient>(
    () => ({
      preview: true,
      request,
      photoSrc: (id) =>
        current.current.photos.find((p) => p.id === id)?.src ?? "",
      href: (href) => {
        if (mapHref) return mapHref(href);
        const url = new URL(href, "https://preview.invalid");
        if (url.pathname === "/app" && url.searchParams.has("person"))
          return `/?view=profile&person=${encodeURIComponent(url.searchParams.get("person")!)}`;
        if (url.pathname === "/app/feed") return "/";
        const id = /^\/app\/spaces\/([^/]+)$/.exec(url.pathname)?.[1];
        return id
          ? `/preview/spaces?space=${encodeURIComponent(id)}`
          : "/preview/spaces";
      },
    }),
    [request, mapHref],
  );
  const friendships = preview?.state.friendships ?? [];
  const now = preview?.now ?? bootstrap.now;
  const feedPosts = visibleSpacePosts(data, friendships, now).filter((post) => {
    const space = data.spaces.find((space) => space.id === post.space?.id);
    return space && spaceIsVisible(space);
  });
  const value = {
    now,
    reports,
    data,
    client,
    feedPosts,
    postsFor: (id: string) => visibleSpacePosts(data, friendships, now, id),
    detailsFor: (id: string) => visibleSpaceDetails(data, friendships, id, now),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
