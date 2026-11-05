import { dayKey, FEED_TIME_ZONE } from "@/features/feed/format";
import { parse } from "tldts";
export const MINIMUM_AGE = 18;
export const DAILY_REGULAR_POSTS = 3;
export const DAILY_IMAGES = 3;
export const SPACE_PHOTO_LIMIT = 20;
export const POSTING_TIME_ZONE = FEED_TIME_ZONE;
export const POSTING_RULE_SUMMARY =
  "Up to three regular posts per calendar day, or one post with a link if it’s your only post that day. Up to three photographs a day in total, shared between posts and Gallery.";
export const POSTING_EDIT_RULE =
  "Published posts and uploaded photographs still count toward the day’s allowance after deletion. Editing uses the original posting day. Add a link only when there are no other publications that day; removing a link returns that post to the regular-post allowance.";
export const POSTING_EXCLUSIONS =
  "Comments and private messages do not count toward this limit.";
// These common filename extensions are also ICANN suffixes. Without URL syntax,
// an isolated two-part name is treated as a filename rather than a pasted link.
const AMBIGUOUS_FILE_SUFFIXES = new Set(["md", "py", "mov", "zip"]);
/** Includes links pasted into ordinary body text, not only the dedicated Link mode. */
export const containsPostLink = (post: {
  body?: string;
  url?: string;
  kind?: string;
  paragraphs?: string[];
  link?: unknown;
}) => {
  if (
    post.kind === "link" ||
    !!post.link ||
    (post.kind !== "post" && !!post.url?.trim())
  )
    return true;
  const text = post.body ?? post.paragraphs?.join("\n") ?? "";
  if (/\b(?:[a-z][a-z\d+.-]*:\/\/|www\.|mailto:|tel:)/i.test(text)) return true;
  // Use the platform URL parser for host boundaries, then the maintained suffix list.
  // A filename such as photo.jpg or index.ts is not a bare web domain.
  for (const match of text.matchAll(
    /[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?\.[\p{L}]{2,63}(?![\p{L}\p{N}-])/gu,
  )) {
    try {
      const { hostname } = new URL(`https://${match[0]}`);
      const result = parse(hostname, { extractHostname: false });
      const following = text.slice(match.index + match[0].length);
      if (
        AMBIGUOUS_FILE_SUFFIXES.has(result.publicSuffix ?? "") &&
        !result.subdomain &&
        !/^(?:[/?#]|:\d)/.test(following)
      )
        continue;
      if (result.isIcann && result.domain) return true;
    } catch {
      /* Plain text that is not a hostname. */
    }
  }
  return false;
};
export type PostingRecord = {
  id: string;
  authorId: string;
  createdAt: string;
  hasLink: boolean;
  imageCount?: number;
  deleted?: boolean;
};
/** Publication records survive deletion; editing reuses the original slot. */
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
          ? "Your link-containing post is your only post for today. Editing it to remove the link returns it to the regular-post allowance."
          : hasLink
            ? "A link-containing post must be your only post today. Deleted posts still count."
            : "You’ve reached today’s three-post limit. Deleted posts still count.",
  };
}
