import Link from "next/link";
import { notFound } from "next/navigation";
import { memberPage } from "@/server/spaces/pages";
import { memberId } from "@/features/social/member-schema";
import { MemberGallery } from "@/features/social/member-gallery";
import { LiveAppShell } from "@/components/layout/live-app-shell";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const query = await searchParams;
  const parsed =
    query.person === undefined ? null : memberId.safeParse(query.person);
  if (parsed && !parsed.success) notFound();
  const result = await memberPage(async (service, subject) => {
    const account = await service.account(subject);
    if (!account) notFound();
    return service.profile(subject, parsed?.data ?? account.id);
  }, "Your gallery");
  return result.data ? (
    <MemberGallery key={result.data.profile.id} data={result.data} />
  ) : (
    <LiveAppShell active="profile">
      <section className="margin-gallery-page">
        <h1>Gallery unavailable</h1>
        <p role="alert">{result.error}</p>
        <Link href="/app/gallery">Try again</Link>
      </section>
    </LiveAppShell>
  );
}
