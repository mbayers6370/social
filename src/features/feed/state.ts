import type { FeedComment } from "./schema";

export type PreviewPostState = {
  liked: boolean;
  comments: FeedComment[];
  draft: string;
  visibleCount: number;
  expandedReplies: string[];
  replyTo: { id: string; name: string } | null;
};
export type PreviewState = Record<string, PreviewPostState>;
export type PreviewAction =
  | { type: "like"; postId: string }
  | { type: "draft"; postId: string; body: string }
  | { type: "reply"; postId: string; replyTo: PreviewPostState["replyTo"] }
  | { type: "more"; postId: string }
  | { type: "reveal"; postId: string; visibleCount: number; rootId?: string }
  | { type: "replies"; postId: string; commentId: string; expanded: boolean }
  | { type: "comment"; postId: string; comment: FeedComment; total: number };

export function previewPostState(
  state: PreviewState,
  postId: string,
): PreviewPostState {
  return (
    state[postId] ?? {
      liked: false,
      comments: [],
      draft: "",
      visibleCount: 5,
      expandedReplies: [],
      replyTo: null,
    }
  );
}

/** Deliberately in-memory. This reducer is not an authentication or persistence layer. */
export function previewReducer(
  state: PreviewState,
  action: PreviewAction,
): PreviewState {
  const current = previewPostState(state, action.postId);
  let next: PreviewPostState;
  switch (action.type) {
    case "like":
      next = { ...current, liked: !current.liked };
      break;
    case "draft":
      next = { ...current, draft: action.body };
      break;
    case "reply":
      next = { ...current, replyTo: action.replyTo };
      break;
    case "more":
      next = { ...current, visibleCount: current.visibleCount + 5 };
      break;
    case "reveal":
      next = {
        ...current,
        visibleCount: Math.max(current.visibleCount, action.visibleCount),
        expandedReplies: action.rootId
          ? [...new Set([...current.expandedReplies, action.rootId])]
          : current.expandedReplies,
      };
      break;
    case "replies": {
      const remaining = (current.expandedReplies ?? []).filter(
        (id) => id !== action.commentId,
      );
      next = {
        ...current,
        expandedReplies: action.expanded
          ? [...remaining, action.commentId]
          : remaining,
      };
      break;
    }
    case "comment":
      next = {
        ...current,
        comments: [...current.comments, action.comment],
        draft: "",
        replyTo: null,
        visibleCount: action.total,
      };
      break;
  }
  return { ...state, [action.postId]: next };
}
