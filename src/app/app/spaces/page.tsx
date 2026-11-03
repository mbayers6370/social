import { notFound } from "next/navigation";
import { memberPage } from "@/server/spaces/pages";
import { resourceId } from "@/features/spaces/schema";
import { SpacesList } from "@/features/spaces/spaces-list";
import { LiveAppShell } from "@/components/layout/live-app-shell";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const q = await searchParams;
  const before =
    q.before === undefined ? undefined : resourceId.safeParse(q.before);
  if (before && !before.success) notFound();
  const result = await memberPage((service, subject) =>
    service.listSpaces(subject, before?.data),
  );
  return (
    <LiveAppShell active="spaces">
      {result.data ? (
        <SpacesList data={result.data} />
      ) : (
        <p role="alert">{result.error}</p>
      )}
    </LiveAppShell>
  );
}
