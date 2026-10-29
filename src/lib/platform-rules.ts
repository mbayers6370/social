import { dayKey, FEED_TIME_ZONE } from "@/features/feed/format";
export const MINIMUM_AGE = 18;
export const DAILY_REGULAR_POSTS = 3;
export const DAILY_IMAGES = 3;
export const POSTING_TIME_ZONE = FEED_TIME_ZONE;
export const POSTING_RULE_SUMMARY =
  "Up to three regular posts per calendar day, or one link-containing post as your only post that day. Up to three photographs total per day, shared between posts and Gallery.";
export const POSTING_EDIT_RULE =
  "Editing or deleting a post recalculates your allowance from the remaining posts. Photographs kept in Gallery still count toward that day’s photo allowance. Add a link only when no other posts remain that day; remove the link to return to the three-post allowance.";
export const POSTING_EXCLUSIONS =
  "Comments and private messages do not count toward this limit.";
/** Includes links pasted into ordinary body text, not only the dedicated Link mode. */
export const containsPostLink = (post: {
  body?: string;
  url?: string;
  kind?: string;
  paragraphs?: string[];
  link?: unknown;
}) =>
  post.kind === "link" ||
  !!post.link ||
  (post.kind !== "post" && !!post.url?.trim()) ||
  /(?:\b[a-z][a-z\d+.-]*:\/\/|\bwww\.|\b(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}\b)/i.test(
    post.body ?? post.paragraphs?.join("\n") ?? "",
  );
export type PostingRecord = {
  id: string;
  authorId: string;
  createdAt: string;
  hasLink: boolean;
  imageCount?: number;
  deleted?: boolean;
};
/** Recomputed from remaining records; replacingId models editing without consuming a second slot. */
export function postingEligibility(
  records: readonly PostingRecord[],
  actorId: string,
  now: Date,
  hasLink: boolean,
  replacingId?: string,
  imageCount = 0,
) {
  const edited = replacingId
    ? records.find(
        (post) => post.id === replacingId && post.authorId === actorId,
      )
    : undefined;
  const today = dayKey(edited?.createdAt ?? now.toISOString());
  const remaining = records.filter(
    (post) =>
      post.authorId === actorId &&
      post.id !== replacingId &&
      !post.deleted &&
      dayKey(post.createdAt) === today,
  );
  const linked = remaining.some((post) => post.hasLink);
  const regularRemaining = linked
    ? 0
    : Math.max(0, DAILY_REGULAR_POSTS - remaining.length);
  const imagesRemaining = Math.max(
    0,
    DAILY_IMAGES -
      remaining.reduce((total, post) => total + (post.imageCount ?? 0), 0),
  );
  const postAllowed = hasLink
    ? remaining.length === 0
    : !linked && regularRemaining > 0;
  const allowed = postAllowed && imageCount <= imagesRemaining;
  return {
    allowed,
    regularRemaining,
    imagesRemaining,
    linkAllowed: remaining.length === 0,
    reason: allowed
      ? ""
      : postAllowed
        ? `You can share up to three photographs per day. ${imagesRemaining} ${imagesRemaining === 1 ? "photograph" : "photographs"} remaining today.`
        : linked
          ? "Your link-containing post is your only post for today. Remove its link or delete it before posting again."
          : hasLink
            ? "A link-containing post must be your only post today. Remove the other posts before adding a link."
            : "You’ve reached today’s three-post limit. Deleting a post makes room for another.",
  };
}
