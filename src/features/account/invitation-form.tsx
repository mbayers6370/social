"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function InvitationForm({
  verify,
  enabled = true,
}: {
  enabled?: boolean;
  verify: (
    previous: { error: string },
    form: FormData,
  ) => Promise<{ error: string }>;
}) {
  const [state, action, pending] = useActionState(verify, {
    error: "",
  });
  return (
    <form
      action={action}
      className="margin-account-form margin-invitation-form"
    >
      <Label htmlFor="invitation-code">Your invitation code</Label>
      <Input
        id="invitation-code"
        name="code"
        autoComplete="off"
        spellCheck={false}
        required
        disabled={!enabled}
        minLength={32}
        maxLength={128}
        aria-describedby="invitation-help"
      />
      <p className="margin-field-hint" id="invitation-help">
        Use the code you received.
      </p>
      {!enabled && (
        <p className="margin-field-hint" role="status">
          {process.env.NODE_ENV === "development"
            ? "Live registration isn’t connected in this preview."
            : "Account setup is temporarily unavailable. Please try again later."}
        </p>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending || !enabled}>
        {pending ? "Checking invitation…" : "Continue"}
      </Button>
    </form>
  );
}
