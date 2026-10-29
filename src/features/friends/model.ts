import { z } from "zod";
import type { Friendship } from "@/lib/friend-audience";
import { PreviewError, type LocalState } from "@/features/local-preview/model";

export type FriendStatus =
  "self" | "none" | "incoming" | "outgoing" | "friends" | "blocked";
export function friendStatus(
  viewerId: string,
  personId: string,
  graph: readonly Friendship[],
): FriendStatus {
  if (viewerId === personId) return "self";
  const pairs = graph.filter(
    ({ people }) =>
      people[0] !== people[1] &&
      people.includes(viewerId) &&
      people.includes(personId),
  );
  if (pairs.some((pair) => pair.status === "blocked")) return "blocked";
  if (pairs.some((pair) => pair.status === "accepted")) return "friends";
  const pending = pairs.filter((pair) => pair.status === "pending");
  // Ambiguous/legacy pending records cannot confer permission to accept.
  if (
    pending.some(
      (pair) => !pair.requestedBy || !pair.people.includes(pair.requestedBy),
    )
  )
    return "blocked";
  if (pending.some((pair) => pair.requestedBy === viewerId)) return "outgoing";
  return pending.length ? "incoming" : "none";
}
export const friendActionSchema = z.strictObject({
  personId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  action: z.enum([
    "send",
    "accept",
    "decline",
    "cancel",
    "remove",
    "block",
    "unblock",
  ]),
});
export type FriendAction = z.infer<typeof friendActionSchema>["action"];
const allowed: Partial<Record<FriendAction, FriendStatus>> = {
  send: "none",
  accept: "incoming",
  decline: "incoming",
  cancel: "outgoing",
  remove: "friends",
};
/** Development-only mutation. Actor comes from the provider, never the action payload.
 * A real repository must enforce these transitions under a DB transaction and session auth. */
export function changeFriendship(
  state: LocalState,
  viewerId: string,
  raw: unknown,
): LocalState {
  const result = friendActionSchema.safeParse(raw);
  if (!result.success)
    throw new PreviewError("That friend action is unavailable.");
  const { personId, action } = result.data;
  if (
    ![viewerId, personId].every((id) =>
      state.profiles.some((profile) => profile.person.id === id),
    )
  )
    throw new PreviewError("That profile is unavailable.");
  const status = friendStatus(viewerId, personId, state.friendships);
  if (action === "block" || action === "unblock") {
    const ownBlock = state.friendships.some(
      (pair) =>
        pair.people.includes(viewerId) &&
        pair.people.includes(personId) &&
        pair.status === "blocked" &&
        pair.blockedBy === viewerId,
    );
    if (status === "self" || (action === "block" ? ownBlock : !ownBlock))
      throw new PreviewError("That profile action is unavailable.");
    const friendships = state.friendships.filter(
      (pair) =>
        !(pair.people.includes(viewerId) && pair.people.includes(personId)) ||
        (pair.status === "blocked" && pair.blockedBy !== viewerId),
    );
    if (action === "block")
      friendships.push({
        people: [viewerId, personId],
        status: "blocked",
        blockedBy: viewerId,
      });
    return { ...state, friendships };
  }
  if (status !== allowed[action])
    throw new PreviewError(
      "This relationship has changed. Check its current status and try again.",
    );
  const friendships = state.friendships.filter(
    ({ people }) => !(people.includes(viewerId) && people.includes(personId)),
  );
  if (action === "send" || action === "accept")
    friendships.push({
      people: [viewerId, personId],
      status: action === "send" ? "pending" : "accepted",
      ...(action === "send" ? { requestedBy: viewerId } : {}),
    });
  return { ...state, friendships };
}
