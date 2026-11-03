"use client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "./auth-shell";
export function AccountPageError({ reset }: { reset: () => void }) {
  return (
    <AuthShell
      title="Account access is unavailable."
      intro="We couldn’t complete this request. Please try again in a moment."
    >
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </AuthShell>
  );
}
