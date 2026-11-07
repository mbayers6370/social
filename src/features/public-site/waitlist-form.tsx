"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    setError("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ?? "We couldn’t save your email. Please try again.",
        );
      }
      setStatus("saved");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Check your connection and try again.",
      );
      setStatus("idle");
    }
  }
  return (
    <div className="margin-welcome-waitlist">
      {status === "saved" ? (
        <p role="status">
          You’re on the list. We’ll be in touch when invitations are available.
        </p>
      ) : (
        <form onSubmit={submit} aria-label="Invitation waitlist">
          <label htmlFor="waitlist-email">
            No invite yet? Leave your email.
          </label>
          <div className="margin-welcome-waitlist-fields">
            <Input
              id="waitlist-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Your email address"
              required
              maxLength={254}
              disabled={status === "saving"}
              aria-describedby="waitlist-purpose"
              aria-invalid={Boolean(error)}
            />
            <Button
              type="submit"
              disabled={status === "saving"}
              className="margin-welcome-invitation-action"
            >
              {status === "saving" ? "Joining…" : "Join the waitlist"}
            </Button>
          </div>
          <p id="waitlist-purpose">
            Join for invitation news only. No account is created.{" "}
            <Link href="/privacy#waitlist">About your email</Link>
          </p>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
