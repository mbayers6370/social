"use client";
import { useState } from "react";
import { SessionAccess } from "@/components/auth/protected-session";
import { OnboardingForm } from "./onboarding-form";
import { Button } from "@/components/ui/button";
/** Fictional content only. The production session endpoint has no fixture bypass. */
export function AuthenticationPreview() {
  const [signedIn, setSignedIn] = useState(true);
  const [showForm, setShowForm] = useState(false);
  if (showForm)
    return (
      <>
        <p>This sample form never creates or changes an account.</p>
        <OnboardingForm
          managed
          saveAction={async () => ({
            error:
              "Sample account setup failed. Your details are still here; try again.",
          })}
        />
        <Button variant="outline" onClick={() => setShowForm(false)}>
          Back to session preview
        </Button>
      </>
    );
  return (
    <>
      <SessionAccess
        expectedSessionId="fictional-session"
        provider={{
          ready: true,
          available: true,
          signedIn,
          sessionId: "fictional-session",
        }}
      >
        <section aria-label="Fictional account">
          <h2>You’re signed in.</h2>
          <p>This is sample account content.</p>
        </section>
      </SessionAccess>
      <Button variant="outline" onClick={() => setShowForm(true)}>
        Preview profile form
      </Button>
      <Button variant="outline" onClick={() => setSignedIn(false)}>
        Simulate session ending
      </Button>
    </>
  );
}
