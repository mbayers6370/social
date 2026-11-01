import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/account/auth-shell";
import { saveOnboarding } from "@/server/account/actions";
import { OnboardingForm } from "@/features/account/onboarding-form";
export default async function OnboardingPage() {
  const managed = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );
  if (!managed && process.env.NODE_ENV !== "development") redirect("/sign-in");
  const user = managed ? await currentUser() : null;
  if (managed && !user) redirect("/sign-in");
  if (user?.publicMetadata.marginOnboardingComplete) redirect("/");
  return (
    <AuthShell
      title="Make yourself at home."
      intro="A name, a little introduction, and room for the people you’ll bring."
    >
      <OnboardingForm
        managed={managed}
        saveAction={saveOnboarding}
        initialName={user?.fullName ?? ""}
        initialUsername={user?.username ?? ""}
      />
    </AuthShell>
  );
}
