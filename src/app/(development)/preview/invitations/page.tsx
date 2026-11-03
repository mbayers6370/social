import { AuthShell } from "@/features/account/auth-shell";
import { notFound } from "next/navigation";
import { InvitationManager } from "@/features/account/invite-friends";
import { InvitationLanding } from "@/features/account/invitation-landing";
export default function InvitationPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <AuthShell
      title="Invitation interaction preview"
      intro="Fictional UI only. Real invitation APIs still require server authorization."
    >
      <InvitationManager available />
      <InvitationLanding token={"a".repeat(43)} />
    </AuthShell>
  );
}
