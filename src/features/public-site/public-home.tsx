import Image from "next/image";
import Link from "next/link";
import lifeHappens from "@/assets/fixtures/life-happens.jpg";
import { buttonVariants } from "@/components/ui/button";
import { PublicTextLink } from "./public-shell";
import { WelcomeMessages } from "./welcome-preview";
import { WelcomeGallery } from "./welcome-gallery";
import { WaitlistForm } from "./waitlist-form";
import { WelcomeCommitments } from "./welcome-commitments";

export function PublicHome() {
  return (
    <>
      <section className="margin-public-hero" aria-labelledby="public-title">
        <header className="margin-welcome-opening">
          <h1 id="public-title">
            <span>A feed that ends.</span> <span>Imagine.</span>
          </h1>
          <p className="margin-public-intro">
            A private social space for the people you actually know.
            Invite-only. Three posts a day. No ads, no algorithm.
          </p>
          <div className="margin-welcome-actions">
            <Link
              href="/how-it-works"
              className={buttonVariants({
                className: "margin-welcome-cta",
              })}
            >
              Membership by invitation
            </Link>
            <PublicTextLink href="#welcome-preview">
              See how it feels
            </PublicTextLink>
          </div>
        </header>
      </section>
      <div className="margin-welcome-friends">
        <div className="margin-welcome-connection-band">
          <section
            className="margin-welcome-connection"
            aria-labelledby="welcome-connection-title"
          >
            <div className="margin-welcome-section-copy">
              <h2 id="welcome-connection-title">
                Less audience.
                <br />
                More friends.
              </h2>
              <p>
                A passing thought becomes a conversation. A photograph becomes a
                plan. That’s the good part.
              </p>
              <PublicTextLink href="/how-it-works">
                How Margin works
              </PublicTextLink>
            </div>
            <div className="margin-welcome-message-stage">
              <WelcomeMessages />
            </div>
          </section>
        </div>
        <section
          className="margin-welcome-how"
          aria-labelledby="welcome-how-title"
        >
          <figure className="margin-welcome-outside">
            <Image
              src={lifeHappens}
              alt="A person walking along a quiet beach beneath misty cliffs."
              sizes="100vw"
            />
            <figcaption>
              <span>Nothing more to catch up on.</span>{" "}
              <span>Somewhere better to be.</span>
            </figcaption>
          </figure>
          <div className="margin-welcome-how-content">
            <h2 id="welcome-how-title">How it works</h2>
            <ul className="margin-welcome-basics">
              <li>
                <h3>You’re invited.</h3>
                <p>
                  Open a friend’s invitation link, verify your email and make
                  your profile.
                </p>
                <PublicTextLink href="/how-it-works#joining">
                  Invitation details
                </PublicTextLink>
              </li>
              <li>
                <h3>Add your people.</h3>
                <p>
                  Find your friends and send a request. You both choose the
                  connection.
                </p>
                <PublicTextLink href="/how-it-works#friends">
                  About friendship
                </PublicTextLink>
              </li>
              <li>
                <h3>Share a little.</h3>
                <p>
                  A thought, a photograph, a small part of your day. Then catch
                  up with theirs.
                </p>
                <PublicTextLink href="/how-it-works#posting">
                  Posting details
                </PublicTextLink>
              </li>
            </ul>
          </div>
        </section>
        <WelcomeCommitments />
        <section
          className="margin-welcome-gallery-section"
          aria-labelledby="welcome-gallery-title"
        >
          <div className="margin-welcome-gallery-heading">
            <h2 id="welcome-gallery-title">
              Three photos a day.
              <br />A gallery of twenty.
            </h2>
          </div>
          <WelcomeGallery />
        </section>
      </div>
      <section
        className="margin-welcome-joining"
        aria-labelledby="welcome-joining-title"
      >
        <div className="margin-welcome-joining-layout">
          <h2 id="welcome-joining-title">
            <span>For the people</span> <span>you think of first.</span>
          </h2>
          <div className="margin-welcome-invitation">
            <p>
              A friend sends you a personal invitation link. Open it to create
              your account and join them on Margin.
            </p>
          </div>
          <WaitlistForm />
        </div>
      </section>
    </>
  );
}
