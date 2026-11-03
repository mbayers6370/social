import { notFound } from "next/navigation";
import { AuthShell } from "@/features/account/auth-shell";
import { OnboardingForm } from "@/features/account/onboarding-form";
import { saveOnboarding } from "@/server/account/actions";

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <AuthShell
      title="Make yourself at home."
      intro="A name, a little introduction, and room for the people you’ll bring."
    >
      <OnboardingForm managed={false} saveAction={saveOnboarding} />
    </AuthShell>
  );
}
