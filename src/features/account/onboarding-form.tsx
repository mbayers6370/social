"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptionalPreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usernameSchema } from "@/features/profile/username";
export function OnboardingForm({
  managed,
  saveAction,
  initialName = "",
  initialUsername = "",
}: {
  managed: boolean;
  saveAction: (
    previous: { error: string; saved?: boolean },
    form: FormData,
  ) => Promise<{ error: string; saved?: boolean }>;
  initialName?: string;
  initialUsername?: string;
}) {
  const preview = useOptionalPreview();
  const router = useRouter();
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(saveAction, {
    error: "",
    saved: false,
  });
  if (state.saved)
    return (
      <div className="margin-auth-unavailable">
        <h2>Your profile is ready.</h2>
        <p>
          Your invitation has been accepted. Pilot account activation is managed
          separately while the live service is being prepared.
        </p>
        <Link href="/">Return to Margin</Link>
      </div>
    );
  return (
    <form
      className="margin-account-form"
      action={managed ? action : undefined}
      onSubmit={
        managed
          ? undefined
          : (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const username = usernameSchema.safeParse(data.get("username"));
              if (!username.success) {
                setError(username.error.issues[0].message);
                return;
              }
              if (data.get("adult") !== "yes") {
                setError("Confirm that you are 18 or older.");
                return;
              }
              try {
                preview?.completeOnboarding({
                  name: String(data.get("name")),
                  bio: String(data.get("bio") ?? ""),
                  username: username.data,
                });
                router.push("/");
              } catch (error) {
                setError(previewMessage(error));
              }
            }
      }
    >
      <Label htmlFor="onboard-name">Your name</Label>
      <Input
        id="onboard-name"
        name="name"
        autoComplete="name"
        defaultValue={initialName}
        required
        maxLength={80}
      />
      <Label htmlFor="onboard-username">Username</Label>
      <Input
        id="onboard-username"
        name="username"
        autoComplete="username"
        defaultValue={initialUsername}
        required
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z][A-Za-z0-9_]*"
        aria-describedby="username-guide"
      />
      <p className="margin-field-hint" id="username-guide">
        Start with a letter. Use 3–24 letters, numbers or underscores.
      </p>
      <Label htmlFor="onboard-bio">A little about you (optional)</Label>
      <textarea id="onboard-bio" name="bio" rows={3} maxLength={300} />
      <label className="margin-account-confirmation">
        <input type="checkbox" name="adult" value="yes" required />
        <span>I am 18 or older.</span>
      </label>
      <p className="margin-field-hint">
        By continuing, you confirm your age eligibility.{" "}
        <Link href="/terms">Read the current terms status</Link> and{" "}
        <Link href="/privacy">privacy information</Link>.
      </p>
      {!managed && (
        <p className="margin-field-hint">
          This sets up a fresh local profile and empty feed. Changes stay in
          this tab.
        </p>
      )}
      {(state.error || error) && <p role="alert">{state.error || error}</p>}
      <Button type="submit" disabled={pending || (!managed && !preview)}>
        {pending ? "Saving…" : managed ? "Save profile" : "Start your space"}
      </Button>
    </form>
  );
}
