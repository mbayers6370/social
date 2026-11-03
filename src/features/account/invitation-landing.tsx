"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvitationLanding({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const emailField = useRef<HTMLInputElement>(null);
  const editingEmail = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!message && editingEmail.current) {
      editingEmail.current = false;
      emailField.current?.focus();
    }
  }, [message]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const email = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();
    setEmail(email);
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.error ?? "We couldn’t send your invitation. Please try again.",
        );
      setMessage(data.message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message ? (
        <div role="status" className="margin-auth-unavailable">
          <p>{message}</p>
          <p>Check the inbox for {email}.</p>
          <p>
            The email contains your own invitation link. Open it to verify your
            address and set up your account.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              editingEmail.current = true;
              setMessage("");
              setError("");
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={send} className="margin-account-form">
          <Label htmlFor="invitation-email">Your email address</Label>
          <Input
            ref={emailField}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            id="invitation-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          <p className="margin-field-hint">
            We’ll send your personal invitation here. Verify your email and
            complete your profile to join.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending your invitation…" : "Email my invitation"}
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="margin-auth-next">
        Already a member? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}

export function InvitationClaim({
  token,
  ticket,
  accept,
}: {
  token: string;
  ticket: string;
  accept: (
    state: { error: string },
    form: FormData,
  ) => Promise<{ error: string }>;
}) {
  const [state, action, pending] = useActionState(accept, { error: "" });
  return (
    <form action={action} className="margin-account-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="ticket" value={ticket} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking your invitation…" : "Continue to account setup"}
      </Button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
