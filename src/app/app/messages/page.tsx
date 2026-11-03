import Link from "next/link";
import { notFound } from "next/navigation";
import { memberPage } from "@/server/spaces/pages";
import { MemberMessages } from "@/features/social/member-messages";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { memberId } from "@/features/social/member-schema";
import { MessagingOff } from "@/features/social/messaging-off";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const query = await searchParams;
  const parsed =
    query.thread === undefined ? null : memberId.safeParse(query.thread);
  if (parsed && !parsed.success) notFound();
  const result = await memberPage(async (service, subject) => {
    const identity = await service.identity(subject);
    if (!identity.preferences.messagingEnabled)
      return {
        disabled: true as const,
        threads: [],
        nextCursor: null,
        conversation: null,
      };
    const { threads, nextCursor } = await service.threads(subject);
    const selected = parsed?.data ?? threads[0]?.id;
    return {
      disabled: false as const,
      threads,
      nextCursor,
      conversation: selected
        ? await service.conversation(subject, selected)
        : null,
    };
  }, "Messages");
  if (result.data?.disabled)
    return (
      <LiveAppShell active="messages">
        <MessagingOff />
      </LiveAppShell>
    );
  return result.data ? (
    <MemberMessages
      initialThreads={result.data.threads}
      initialNextCursor={result.data.nextCursor}
      initialConversation={result.data.conversation}
      selectedId={parsed?.data}
      referenceTime={new Date().toISOString()}
    />
  ) : (
    <LiveAppShell active="messages">
      <section className="margin-messages">
        <h1>Messages unavailable</h1>
        <p role="alert">{result.error}</p>
        <Link href="/app/messages">Try again</Link>
      </section>
    </LiveAppShell>
  );
}
