import { notFound } from "next/navigation";
import { memberPage } from "@/server/spaces/pages";
import { resourceId } from "@/features/spaces/schema";
import { SpaceDetails } from "@/features/spaces/space-details";
import { SpaceTimeline } from "@/features/spaces/space-timeline";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { z } from "zod";
const querySchema = z
  .object({
    before: resourceId.optional(),
    post: resourceId.optional(),
    comment: resourceId.optional(),
  })
  .strict()
  .refine((query) => !query.comment || Boolean(query.post))
  .refine((query) => !query.before || !query.post);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = querySchema.safeParse(await searchParams);
  if (!resourceId.safeParse(id).success || !query.success) notFound();
  const q = query.data;
  const result = await memberPage(async (service, subject) => ({
    space: await service.readSpace(subject, id),
    posts: await service.posts(subject, id, q.before, q.post),
  }));
  return (
    <LiveAppShell active="spaces">
      {result.data ? (
        <SpaceDetails
          data={result.data.space}
          hasPosts={result.data.posts.posts.length > 0}
        >
          <SpaceTimeline
            data={result.data.posts}
            viewerId={result.data.space.viewerId}
            href={`/app/spaces/${id}`}
            conversationTarget={
              q.post ? { postId: q.post, commentId: q.comment } : undefined
            }
          />
        </SpaceDetails>
      ) : (
        <p role="alert">{result.error}</p>
      )}
    </LiveAppShell>
  );
}
