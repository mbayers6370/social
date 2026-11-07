import type { Metadata } from "next";
import Link from "next/link";
import { InvitationEntry } from "@/features/account/invitation-entry";

export const metadata: Metadata = {
  title: "Open your invitation",
  description: "Have a Margin invitation? Open your personal link to join.",
};

export default function JoinPage() {
  return (
    <article className="margin-public-document margin-public-join-page">
      <header>
        <h1>Your people are waiting.</h1>
        <p className="margin-public-intro">
          Paste the invitation link your friend sent you to get started. If it
          arrived by email, you can open it straight from your inbox.
        </p>
      </header>
      <InvitationEntry />
      <p>
        Already a member? <Link href="/sign-in">Sign in</Link>
      </p>
      <p>
        No invitation yet?{" "}
        <Link href="/welcome#welcome-joining-title">Join the waitlist</Link>
      </p>
    </article>
  );
}
