import Link from "next/link";
import { memberPage } from "@/server/spaces/pages";
import { MemberFriends } from "@/features/social/member-friends";
import { LiveAppShell } from "@/components/layout/live-app-shell";
export default async function Page() {
  const result = await memberPage(
    (service, subject) => service.contacts(subject),
    "Your friends",
  );
  return result.data ? (
    <MemberFriends initial={result.data} />
  ) : (
    <LiveAppShell active="profile">
      <section className="margin-friends-page">
        <h1>Friends unavailable</h1>
        <p role="alert">{result.error}</p>
        <Link href="/app/friends">Try again</Link>
      </section>
    </LiveAppShell>
  );
}
