export type Friendship = {
  people: [string, string];
  status: "accepted" | "pending" | "blocked";
  requestedBy?: string;
};

/** Call with identities/relationships loaded by the server for real user data. */
export function canReadFriendsPost(
  viewerId: string | null,
  authorId: string,
  friendships: readonly Friendship[],
) {
  if (!viewerId?.trim() || !authorId.trim()) return false;
  if (viewerId === authorId) return true;
  const relationships = friendships.filter(
    ({ people }) =>
      people.includes(viewerId) &&
      people.includes(authorId) &&
      people[0] !== people[1],
  );
  return (
    !relationships.some(({ status }) => status === "blocked") &&
    relationships.some(({ status }) => status === "accepted")
  );
}
