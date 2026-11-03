import { createLocalId } from "@/lib/local-id";
import type { Friendship } from "@/lib/friend-audience";
import { reportSchema, type SafetyReport } from "@/features/safety/model";
import { visibleSpacePosts } from "./preview-selectors";
import type { SpacesPreviewData } from "./preview-provider";

export function createSpacePreviewReport(
  data: SpacesPreviewData,
  relationships: readonly Friendship[],
  now: number,
  raw: unknown,
): SafetyReport {
  const input = reportSchema.parse(raw);
  const post = data.posts.find((post) => post.id === input.target.id);
  if (
    input.target.kind !== "post" ||
    !post?.space ||
    post.author.id !== input.target.personId ||
    post.author.id === data.viewer.id ||
    !visibleSpacePosts(data, relationships, now, post.space.id).some(
      (item) => item.id === post.id,
    )
  )
    throw Error("That report target is unavailable.");
  return {
    ...input,
    id: createLocalId(),
    createdAt: new Date(now).toISOString(),
    status: "saved-locally",
  };
}
