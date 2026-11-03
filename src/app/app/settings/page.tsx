import Link from "next/link";
import { memberPage } from "@/server/spaces/pages";
import { MemberSettings } from "@/features/social/member-settings";
import { LiveAppShell } from "@/components/layout/live-app-shell";
export default async function Page() {
  const result = await memberPage(
    async (service, subject) => ({
      identity: await service.identity(subject),
      safety: await service.safety(subject),
    }),
    "Your settings",
  );
  return result.data ? (
    <MemberSettings
      initial={result.data.identity}
      safety={result.data.safety}
    />
  ) : (
    <LiveAppShell active="profile">
      <section className="margin-settings-page">
        <h1>Settings unavailable</h1>
        <p role="alert">{result.error}</p>
        <Link href="/app/settings">Try again</Link>
      </section>
    </LiveAppShell>
  );
}
