import type { FeedPost } from "./schema";

export type ConversationSelection = {
  commentId?: string;
  mainFeed?: boolean;
  post: FeedPost;
  trigger: HTMLElement;
  scrollY: number;
  documentTop: number;
  rect: { left: number; top: number; width: number; height: number };
};

/** Capture the source card before either transport opens the shared animation. */
export function selectConversation(
  post: FeedPost,
  trigger: HTMLElement,
  forceFlip = false,
  commentId?: string,
): ConversationSelection | null {
  const card = document.getElementById(post.id);
  if (!card) return null;
  const scrollY = window.scrollY;
  let rect = card.getBoundingClientRect();
  if (window.matchMedia("(min-width: 1024px)").matches) {
    const topInset =
      (document.querySelector(".margin-header")?.getBoundingClientRect()
        .height ?? 0) + 32;
    const availableHeight = Math.min(
      640,
      Math.max(0, window.innerHeight - topInset - 32),
    );
    const pairHeight = forceFlip
      ? availableHeight
      : Math.max(rect.height, availableHeight);
    if (
      rect.top < topInset ||
      rect.top + Math.min(pairHeight, window.innerHeight - topInset - 32) >
        window.innerHeight - 32
    ) {
      window.scrollBy({ top: rect.top - topInset, behavior: "instant" });
      rect = card.getBoundingClientRect();
    }
  }
  return {
    commentId,
    mainFeed: Boolean(card.closest('[data-main-feed="true"]')),
    post,
    trigger,
    scrollY,
    documentTop: rect.top + window.scrollY,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}
