import { notFound } from "next/navigation";
import { AuthShell } from "@/features/account/auth-shell";
import { MemberPreview } from "@/features/social/member-preview";
import { AuthenticationPreview } from "@/features/account/authentication-preview";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    area?: string;
    thread?: string;
    post?: string;
    comment?: string;
    messaging?: string;
    profileMessaging?: string;
  }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  if (query.view === "member")
    return (
      <MemberPreview
        area={query.area ?? "feed"}
        thread={query.thread}
        messagingEnabled={query.messaging !== "off"}
        profileMessagingEnabled={query.profileMessaging !== "off"}
        conversationTarget={
          query.post
            ? { postId: query.post, commentId: query.comment }
            : undefined
        }
      />
    );
  return (
    <AuthShell
      title="Account access preview"
      intro="Fictional session states for local interface checks. This does not sign in or grant access to account data."
    >
      <AuthenticationPreview />
    </AuthShell>
  );
}
