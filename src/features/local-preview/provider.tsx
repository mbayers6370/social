"use client";

import { canReadFriendsPost } from "@/lib/friend-audience";
import { createLocalId } from "@/lib/local-id";
import {
  changeFriendship,
  friendStatus,
  type FriendAction,
} from "@/features/friends/model";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  profileInputSchema,
  type ProfileInput,
} from "@/features/profile/schema";
import {
  changeGallery,
  changeLocalUsername,
  setProfilePhotograph,
  emptyDraft,
  initialLocalState,
  placePhoto,
  PreviewError,
  publishLocalPost,
  editLocalPost,
  deleteLocalPost,
  deleteLocalPhoto,
  reorderGallery,
  preferencesSchema,
  type Preferences,
  type Bootstrap,
  type FriendProfileContent,
  type LocalState,
  type Photo,
  type PostInput,
} from "./model";
import { commentInputSchema } from "@/features/feed/schema";
import { musicSelectionSchema } from "@/features/profile/music-schema";
import type { ProfileTrack } from "@/features/profile/schema";
import { validateLocalPhoto } from "./upload";
import { saveGalleryArrangement } from "@/features/gallery/arrangement";
import {
  messageInputSchema,
  type PreviewMessage,
  type PreviewThread,
} from "@/features/messages/schema";
import {
  previewReducer,
  type PreviewAction,
  type PreviewState,
} from "@/features/feed/state";
import type { Dispatch, SetStateAction } from "react";
import {
  reportSchema,
  type ReportInput,
  type SafetyReport,
} from "@/features/safety/model";
import {
  initialNotificationState,
  notificationReducer,
  notificationsSchema,
  visibleNotifications,
  notificationAvailable,
  type NotificationState,
  type NotificationPreferences,
  type NotificationTarget,
} from "@/features/notifications/model";
type ConversationRequest = {
  requestId: string;
  target: Extract<NotificationTarget, { kind: "conversation" }>;
};

type Preview = {
  freshStart: boolean;
  threads: PreviewThread[];
  allNotifications: ReturnType<typeof notificationsSchema.parse>;
  headerPanel: "profile" | "notifications" | null;
  setHeaderPanel: Dispatch<SetStateAction<"profile" | "notifications" | null>>;
  profileEditRequested: boolean;
  requestProfileEdit: () => void;
  finishProfileEditRequest: () => void;
  changeFriend: (
    personId: string,
    action: FriendAction,
  ) => void | Promise<void>;
  notifications: NotificationState;
  notificationRows: ReturnType<typeof visibleNotifications>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateNotificationPreferences: (
    patch: Partial<NotificationPreferences>,
  ) => void;
  conversationRequest: ConversationRequest | null;
  requestNotificationConversation: (id: string) => boolean;
  finishNotificationRequest: (id: string, unavailable?: boolean) => void;
  notificationNavigationStatus: string;
  setMusic: (tracks: ProfileTrack[]) => void;
  preferences: Preferences;
  updatePreferences: (patch: Partial<Preferences>) => void;
  movePhoto: (id: string, targetId: string) => void;
  interactions: PreviewState;
  dispatchInteraction: Dispatch<PreviewAction>;
  now: number;
  bootstrap: Bootstrap;
  state: LocalState;
  draft: PostInput;
  messageDrafts: Record<string, string>;
  messageAdditions: Record<string, PreviewMessage[]>;
  sendMessage: (personId: string, body: string) => void;
  reports: SafetyReport[];
  submitReport: (input: ReportInput) => string;
  completeOnboarding: (input: ProfileInput & { username: string }) => void;
  updateMessageDraft: (threadId: string, body: string) => void;
  notebookNotes: PreviewMessage[];
  addNotebookNote: (body: string) => void;
  updateDraft: (patch: Partial<PostInput>) => void;
  publish: (input: unknown) => string;
  editPost: (id: string, input: unknown) => void;
  deletePost: (id: string) => void;
  deletePhoto: (id: string) => void;
  saveGallery: (input: unknown) => void;
  postStatus: string;
  upload: (file: File, description: string) => Promise<Photo>;
  place: (id: string, replacement?: string) => void;
  changeGallery: (
    id: string,
    action: "remove" | "feature" | "earlier" | "later",
  ) => void;
  updateProfile: (value: ProfileInput) => void;
  setProfilePhoto: (photoId: string, replacement?: string) => void;
  changeUsername: (value: unknown) => void;
};
const Context = createContext<Preview | null>(null);
export function PreviewProvider({
  bootstrap,
  children,
  loadFriendProfileAction,
}: {
  bootstrap: Bootstrap;
  children: ReactNode;
  loadFriendProfileAction?: (
    personId: string,
  ) => Promise<FriendProfileContent | null>;
}) {
  const [state, setState] = useState(() => initialLocalState(bootstrap));
  const [interactions, dispatchInteraction] = useReducer(
    (current: PreviewState, action: PreviewAction) =>
      previewReducer(current, action, bootstrap.viewerId),
    {},
  );
  const [now, setNow] = useState(() => Date.parse(bootstrap.now));
  const [draft, setDraft] = useState<PostInput>(emptyDraft);
  const [notebookNotes, setNotebookNotes] = useState<PreviewMessage[]>([]);
  const [messageAdditions, setMessageAdditions] = useState<
    Record<string, PreviewMessage[]>
  >({});
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [freshStart, setFreshStart] = useState(false);
  // Tab memory only: survives client navigation, never written to browser storage.
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
    {},
  );
  const [headerPanel, setHeaderPanel] = useState<
    "profile" | "notifications" | null
  >(null);
  const [profileEditRequested, setProfileEditRequested] = useState(false);
  const requestProfileEdit = useCallback(
    () => setProfileEditRequested(true),
    [],
  );
  const finishProfileEditRequest = useCallback(
    () => setProfileEditRequested(false),
    [],
  );
  const [postStatus, setPostStatus] = useState("");
  const [notificationSource] = useState(() =>
    notificationsSchema.parse(bootstrap.notifications ?? []),
  );
  const [notifications, dispatchNotification] = useReducer(
    notificationReducer,
    notificationSource,
    (rows) => initialNotificationState(rows, bootstrap.viewerId),
  );
  const notificationRows = visibleNotifications(
    (freshStart ? [] : notificationSource).filter((row) => {
      if (row.target.kind !== "profile") return true;
      const relationship = friendStatus(
        bootstrap.viewerId,
        row.target.personId,
        state.friendships,
      );
      if (row.kind === "friend_request") return relationship === "incoming";
      if (row.kind === "friend_accepted") return relationship === "friends";
      return true;
    }),
    bootstrap.viewerId,
    notifications,
    now,
  );
  const [conversationRequest, setConversationRequest] =
    useState<ConversationRequest | null>(null);
  const latestConversationRequest = useRef<ConversationRequest | null>(null);
  const [notificationNavigationStatus, setNotificationNavigationStatus] =
    useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    readingSize: "standard",
    motion: "system",
  });
  useEffect(() => {
    const root = document.documentElement;
    const previousSize = root.getAttribute("data-reading-size");
    const previousMotion = root.getAttribute("data-motion");
    root.setAttribute("data-reading-size", preferences.readingSize);
    root.setAttribute("data-motion", preferences.motion);
    return () => {
      if (previousSize === null) root.removeAttribute("data-reading-size");
      else root.setAttribute("data-reading-size", previousSize);
      if (previousMotion === null) root.removeAttribute("data-motion");
      else root.setAttribute("data-motion", previousMotion);
    };
  }, [preferences]);
  const latest = useRef(state);
  const urls = useRef(new Set<string>());
  const mounted = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const currentUrls = urls.current;
    return () => {
      mounted.current = false;
      currentUrls.forEach((url) => URL.revokeObjectURL(url));
      currentUrls.clear();
    };
  }, []);
  function commit(update: (current: LocalState) => LocalState) {
    const next = update(latest.current);
    latest.current = next;
    setState(next);
  }
  function commitPhotoChange(next: LocalState) {
    const remaining = new Set(next.photos.map((photo) => photo.id));
    const removed = latest.current.photos.filter(
      (photo) => !remaining.has(photo.id),
    );
    const ids = new Set(removed.map((photo) => photo.id));
    commit(() => next);
    if (!ids.size) return;
    setDraft((current) => ({
      ...current,
      photoIds: current.photoIds?.filter((photoId) => !ids.has(photoId)),
      replacements: Object.fromEntries(
        Object.entries(current.replacements ?? {}).filter(
          ([source, target]) => !ids.has(source) && !ids.has(target),
        ),
      ),
    }));
    const current = latest.current;
    for (const src of new Set(removed.map((photo) => photo.image.src))) {
      if (
        src &&
        urls.current.has(src) &&
        !current.photos.some((item) => item.image.src === src) &&
        !current.posts.some((post) =>
          post.media?.some((item) => item.image.src === src),
        ) &&
        !current.profiles.some(
          (profile) =>
            profile.person.photo?.src === src ||
            profile.photos.some((item) => item.image.src === src) ||
            profile.recent.some((post) => post.image?.image.src === src),
        )
      ) {
        URL.revokeObjectURL(src);
        urls.current.delete(src);
      }
    }
  }
  const value: Preview = {
    freshStart,
    threads: freshStart
      ? [
          {
            id: bootstrap.viewerId,
            contact: state.profiles.find(
              (profile) => profile.person.id === bootstrap.viewerId,
            )!.person,
            unread: false,
            messages: [],
          },
        ]
      : (bootstrap.threads ?? []),
    allNotifications: freshStart
      ? []
      : notificationSource.filter(
          (row) =>
            row.recipientId === bootstrap.viewerId &&
            Date.parse(row.createdAt) <= now,
        ),
    headerPanel,
    setHeaderPanel,
    profileEditRequested,
    requestProfileEdit,
    finishProfileEditRequest,
    changeFriend: (personId, action) => {
      if (action === "accept" && loadFriendProfileAction) {
        // Validate before fetching, then revalidate on commit if another action intervenes.
        changeFriendship(latest.current, bootstrap.viewerId, {
          personId,
          action,
        });
        return new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            try {
              const content = await loadFriendProfileAction(personId);
              if (!mounted.current) {
                resolve();
                return;
              }
              if (
                content &&
                (content.profile.person.id !== personId ||
                  content.posts.some((post) => post.author.id !== personId))
              ) {
                throw new PreviewError("That profile is unavailable.");
              }
              commit((current) => {
                const next = changeFriendship(current, bootstrap.viewerId, {
                  personId,
                  action,
                });
                if (!content) return next;
                const knownIds = new Set(next.posts.map((post) => post.id));
                return {
                  ...next,
                  profiles: next.profiles.map((profile) =>
                    profile.person.id === personId ? content.profile : profile,
                  ),
                  posts: [
                    ...next.posts,
                    ...content.posts.filter((post) => !knownIds.has(post.id)),
                  ],
                };
              });
              resolve();
            } catch {
              reject(
                new PreviewError(
                  "Couldn’t accept the request. Please try again.",
                ),
              );
            }
          });
        });
      }
      commit((current) =>
        changeFriendship(current, bootstrap.viewerId, { personId, action }),
      );
    },
    notifications,
    notificationRows,
    markNotificationRead: (id) => {
      if (notificationRows.some((row) => row.id === id))
        dispatchNotification({ type: "read", ids: [id] });
    },
    markAllNotificationsRead: () =>
      dispatchNotification({
        type: "read",
        ids: notificationRows.map((row) => row.id),
      }),
    updateNotificationPreferences: (patch) =>
      dispatchNotification({ type: "preferences", patch }),
    conversationRequest,
    requestNotificationConversation(id) {
      const row = notificationRows.find((item) => item.id === id);
      if (
        !row ||
        row.target.kind !== "conversation" ||
        !notificationAvailable(
          row,
          bootstrap.viewerId,
          latest.current.friendships,
          now,
          state.profiles.map((profile) => profile.person.id),
        )
      )
        return false;
      dispatchNotification({ type: "read", ids: [id] });
      setNotificationNavigationStatus("");
      const request = { requestId: createLocalId(), target: row.target };
      latestConversationRequest.current = request;
      setConversationRequest(request);
      return true;
    },
    finishNotificationRequest: (id, unavailable = false) => {
      if (latestConversationRequest.current?.requestId !== id) return;
      latestConversationRequest.current = null;
      setConversationRequest(null);
      setNotificationNavigationStatus(
        unavailable ? "This content is no longer available." : "",
      );
    },
    notificationNavigationStatus,
    setMusic: (tracks) => {
      const onRepeat = musicSelectionSchema.parse(tracks);
      commit((current) => ({
        ...current,
        profiles: current.profiles.map((profile) =>
          profile.person.id === bootstrap.viewerId
            ? { ...profile, onRepeat }
            : profile,
        ),
      }));
    },
    preferences,
    updatePreferences: (patch) =>
      setPreferences((current) =>
        preferencesSchema.parse({ ...current, ...patch }),
      ),
    movePhoto: (id, targetId) =>
      commit((current) =>
        reorderGallery(current, bootstrap.viewerId, id, targetId),
      ),
    interactions,
    dispatchInteraction(action) {
      if (action.type === "comment") {
        const author = latest.current.profiles.find(
          (profile) => profile.person.id === bootstrap.viewerId,
        )?.person;
        if (!author) return;
        const body = commentInputSchema.safeParse({
          body: action.comment.body,
        });
        if (!body.success) return;
        dispatchInteraction({
          ...action,
          comment: { ...action.comment, author, body: body.data.body },
        });
        return;
      }
      if (action.type === "edit-comment" || action.type === "delete-comment") {
        const post = latest.current.posts.find(
          (post) => post.id === action.postId,
        );
        const comment = post?.comments.find(
          (comment) =>
            comment.id === action.commentId &&
            comment.author.id === bootstrap.viewerId,
        );
        if (comment) {
          if (comment.deletedAt || !Number.isFinite(Date.parse(action.at)))
            return;
          const parsed =
            action.type === "edit-comment"
              ? commentInputSchema.safeParse({ body: action.body })
              : null;
          if (parsed && !parsed.success) return;
          commit((current) => ({
            ...current,
            posts: current.posts.map((post) =>
              post.id !== action.postId
                ? post
                : {
                    ...post,
                    comments: post.comments.map((item) =>
                      item.id !== comment.id
                        ? item
                        : action.type === "delete-comment"
                          ? { ...item, body: "", deletedAt: action.at }
                          : {
                              ...item,
                              body: parsed!.data!.body,
                              editedAt: action.at,
                            },
                    ),
                  },
            ),
          }));
          return;
        }
      }
      dispatchInteraction(action);
    },
    now,
    bootstrap,
    state,
    draft,
    messageDrafts,
    messageAdditions,
    sendMessage(personId, body) {
      if (
        friendStatus(
          bootstrap.viewerId,
          personId,
          latest.current.friendships,
        ) !== "friends"
      )
        throw new PreviewError(
          "You can message accepted friends. This relationship has changed.",
        );
      const input = messageInputSchema.parse({ body });
      const message: PreviewMessage = {
        id: createLocalId(),
        body: input.body,
        direction: "outgoing",
        createdAt: new Date().toISOString(),
      };
      setMessageAdditions((current) => ({
        ...current,
        [personId]: [...(current[personId] ?? []), message],
      }));
    },
    reports,
    submitReport(input) {
      const parsed = reportSchema.parse(input);
      const target = parsed.target;
      const readablePosts = latest.current.posts.filter(
        (post) =>
          Date.parse(post.expiresAt) > now &&
          canReadFriendsPost(
            bootstrap.viewerId,
            post.author.id,
            latest.current.friendships,
          ),
      );
      const available =
        target.kind === "profile"
          ? target.id === target.personId &&
            latest.current.profiles.some(
              (profile) => profile.person.id === target.personId,
            )
          : target.kind === "post"
            ? readablePosts.some(
                (post) =>
                  post.id === target.id && post.author.id === target.personId,
              )
            : target.kind === "comment"
              ? readablePosts.some((post) =>
                  [
                    ...post.comments,
                    ...(interactions[post.id]?.comments ?? []),
                  ].some(
                    (comment) =>
                      comment.id === target.id &&
                      comment.author.id === target.personId &&
                      !comment.deletedAt,
                  ),
                )
              : (!freshStart &&
                  (bootstrap.threads ?? []).some(
                    (thread) =>
                      thread.id === target.id &&
                      thread.contact.id === target.personId,
                  )) ||
                (target.kind === "message" &&
                  target.id === target.personId &&
                  Boolean(messageAdditions[target.id]?.length));
      if (target.personId === bootstrap.viewerId || !available)
        throw new PreviewError("That report target is unavailable.");
      const id = createLocalId();
      setReports((current) => [
        ...current,
        {
          ...parsed,
          id,
          createdAt: new Date().toISOString(),
          status: "saved-locally",
        },
      ]);
      return id;
    },
    completeOnboarding(input) {
      const details = profileInputSchema.parse({
        name: input.name,
        bio: input.bio,
      });
      const currentProfile = latest.current.profiles.find(
        (profile) => profile.person.id === bootstrap.viewerId,
      )!;
      let next = latest.current;
      if (input.username !== currentProfile.handle)
        next = changeLocalUsername(
          next,
          bootstrap.viewerId,
          input.username,
          new Date(now),
        );
      commit(() => ({
        ...next,
        usernameChangedAt: undefined,
        friendships: next.friendships.filter(
          (pair) => !pair.people.includes(bootstrap.viewerId),
        ),
        posts: next.posts.filter(
          (post) => post.author.id !== bootstrap.viewerId,
        ),
        gallery: [],
        galleryAdditions: [],
        postingRecords: [],
        photos: next.photos.filter(
          (photo) => photo.ownerId !== bootstrap.viewerId,
        ),
        profiles: next.profiles.map((profile) =>
          profile.person.id === bootstrap.viewerId
            ? {
                ...profile,
                bio: details.bio,
                recent: [],
                photos: [],
                onRepeat: [],
                person: {
                  ...profile.person,
                  name: details.name,
                  initials: details.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join(""),
                  photo: undefined,
                },
              }
            : profile,
        ),
      }));
      setMessageAdditions({});
      setMessageDrafts({});
      setNotebookNotes([]);
      setReports([]);
      setDraft(emptyDraft);
      setFreshStart(true);
      dispatchInteraction({ type: "reset" });
    },
    notebookNotes,
    addNotebookNote: (body) => {
      const input = messageInputSchema.parse({ body });
      const note: PreviewMessage = {
        id: createLocalId(),
        body: input.body,
        direction: "outgoing",
        createdAt: new Date().toISOString(),
      };
      setNotebookNotes((current) => [...current, note]);
    },
    updateMessageDraft: (threadId, body) =>
      setMessageDrafts((current) => {
        const next = { ...current };
        if (body) next[threadId] = body;
        else delete next[threadId];
        return next;
      }),
    postStatus,
    updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    publish(input) {
      const id = `post-local-${createLocalId()}`;
      commit((current) =>
        publishLocalPost(current, bootstrap.viewerId, input, id, new Date(now)),
      );
      setDraft(emptyDraft);
      setPostStatus("Post shared.");
      return id;
    },
    editPost(id, input) {
      commit((current) =>
        editLocalPost(current, bootstrap.viewerId, id, input, new Date(now)),
      );
      setPostStatus("Post updated.");
    },
    deletePost(id) {
      commit((current) =>
        deleteLocalPost(current, bootstrap.viewerId, id, new Date(now)),
      );
      setPostStatus("Post deleted.");
    },
    deletePhoto(id) {
      commitPhotoChange(
        deleteLocalPhoto(latest.current, bootstrap.viewerId, id),
      );
    },
    saveGallery(input) {
      commitPhotoChange(
        saveGalleryArrangement(
          latest.current,
          bootstrap.viewerId,
          input,
          new Date(now),
        ),
      );
    },
    async upload(file, description) {
      if (
        latest.current.photos.filter((photo) => photo.kind === "local")
          .length >= 40
      )
        throw new PreviewError(
          "This local session already has 40 photographs. Refresh to start a new session.",
        );
      const dimensions = await validateLocalPhoto(file, description);
      if (
        latest.current.photos.filter((photo) => photo.kind === "local")
          .length >= 40
      )
        throw new PreviewError(
          "This local session already has 40 photographs. Refresh to start a new session.",
        );
      if (!mounted.current)
        throw new PreviewError("Photo selection was cancelled.");
      const src = URL.createObjectURL(file);
      urls.current.add(src);
      const photo: Photo = {
        id: `photo-${createLocalId()}`,
        ownerId: bootstrap.viewerId,
        title: description.trim().slice(0, 100),
        description: description.trim(),
        caption: description.trim().slice(0, 200),
        aspect: dimensions.width > dimensions.height ? "landscape" : "portrait",
        image: { src, ...dimensions },
        kind: "local",
      };
      commit((current) => ({ ...current, photos: [...current.photos, photo] }));
      return photo;
    },
    place: (id, replacement) =>
      commit((current) =>
        placePhoto(current, bootstrap.viewerId, id, replacement, new Date(now)),
      ),
    changeGallery: (id, action) =>
      commit((current) =>
        changeGallery(current, bootstrap.viewerId, id, action),
      ),
    changeUsername(value) {
      commit((current) =>
        changeLocalUsername(current, bootstrap.viewerId, value, new Date(now)),
      );
    },
    setProfilePhoto(photoId, replacement) {
      commit((current) =>
        setProfilePhotograph(
          current,
          bootstrap.viewerId,
          photoId,
          replacement,
          new Date(now),
        ),
      );
    },
    updateProfile(value) {
      const parsed = profileInputSchema.safeParse(value);
      if (!parsed.success) throw new PreviewError("Check your name and bio.");
      commit((current) => ({
        ...current,
        posts: current.posts.map((post) =>
          post.author.id === bootstrap.viewerId
            ? { ...post, author: { ...post.author, name: parsed.data.name } }
            : post,
        ),
        profiles: current.profiles.map((profile) =>
          profile.person.id === bootstrap.viewerId
            ? {
                ...profile,
                person: { ...profile.person, name: parsed.data.name },
                bio: parsed.data.bio,
              }
            : profile,
        ),
      }));
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreview() {
  const value = useContext(Context);
  if (!value) throw new Error("Local preview provider is unavailable");
  return value;
}
export function useOptionalPreview() {
  return useContext(Context);
}
