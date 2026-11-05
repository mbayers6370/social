import { notFound } from "next/navigation";
import { memberPage } from "@/server/spaces/pages";
import { resourceId } from "@/features/spaces/schema";
import { MemberFeed } from "@/features/social/member-feed";
import { SocialError } from "@/server/social/errors";
import { eventSpacesEnabled } from "@/features/spaces/availability";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const q = await searchParams;
  const cursor =
    q.before === undefined ? undefined : resourceId.safeParse(q.before);
  if (cursor && !cursor.success) notFound();
  const result = await memberPage(async (service, subject) => {
    const viewer = await service.account(subject);
    if (!viewer || viewer.accountStatus !== "ACTIVE")
      throw new SocialError(403, "Account is not active");
    return {
      viewer,
      page: await service.feed(subject, cursor?.data, eventSpacesEnabled),
    };
  }, "Your feed");
  return (
    <MemberFeed
      data={result.data}
      error={result.error}
      older={Boolean(cursor)}
      referenceTime={new Date().toISOString()}
    />
  );
}
