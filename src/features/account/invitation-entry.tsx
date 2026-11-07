"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitationDestination } from "./invitation-destination";

export function InvitationEntry() {
  const router = useRouter();
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(
      new FormData(event.currentTarget).get("invitation") ?? "",
    );
    const destination = invitationDestination(value, window.location.origin);
    if (!destination) {
      setError("Paste the full Margin invitation link your friend sent you.");
      return;
    }
    setError("");
    router.push(destination);
  }
  return (
    <form onSubmit={submit} className="margin-account-form">
      <Label htmlFor="invitation-link">Your invitation link</Label>
      <Input
        id="invitation-link"
        name="invitation"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={8192}
        placeholder="https://margin.social/invite/…"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "invitation-link-error" : undefined}
      />
      <Button type="submit">Open my invitation</Button>
      {error && (
        <p id="invitation-link-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
