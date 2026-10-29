import type { FeedComment } from "./schema";

export type CommentThread = { comment: FeedComment; replies: FeedComment[] };

/** Keep every comment visible, including orphaned or cyclic fixture references. */
export function groupCommentThreads(
  comments: readonly FeedComment[],
): CommentThread[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const groups = new Map<string, CommentThread>();
  for (const comment of comments) {
    let root = comment;
    const visited = new Set<string>();
    while (root.replyTo && byId.has(root.replyTo)) {
      if (visited.has(root.id)) {
        root = comment;
        break;
      }
      visited.add(root.id);
      root = byId.get(root.replyTo)!;
    }
    let group = groups.get(root.id);
    if (!group) {
      group = { comment: root, replies: [] };
      groups.set(root.id, group);
    }
    if (comment.id !== root.id) group.replies.push(comment);
  }
  const chronological = (a: FeedComment, b: FeedComment) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return [...groups.values()]
    .map((group) => ({ ...group, replies: group.replies.sort(chronological) }))
    .sort((a, b) => chronological(a.comment, b.comment));
}
