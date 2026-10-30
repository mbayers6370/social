import Image from "next/image";
import Link from "next/link";
import lifeHappens from "@/assets/fixtures/life-happens.jpg";
import { buttonVariants } from "@/components/ui/button";
import { PublicTextLink } from "./public-shell";
import { WelcomeMessages, WelcomePreview } from "./welcome-preview";
import { WelcomeGallery } from "./welcome-gallery";

export function PublicHome() {
  return (
    <>
      <section className="margin-public-hero" aria-labelledby="public-title">
        <header className="margin-welcome-opening">
          <h1 id="public-title">
            <span>A little less.</span>
            <span>A little closer.</span>
          </h1>
          <div className="margin-welcome-copy">
            <p className="margin-public-intro">
              A small social space for friends. A little of your day, a little
              of theirs. And room for everything else.
            </p>
            <div className="margin-welcome-actions">
              <Link
                href="/sign-up"
                className={buttonVariants({ className: "margin-welcome-cta" })}
              >
                Join Margin
              </Link>
              <PublicTextLink href="#welcome-preview">
                See how it feels
              </PublicTextLink>
            </div>
            <p className="margin-public-status">
              A small community. An invitation code to begin.
            </p>
          </div>
        </header>
        <div
          className="margin-welcome-story"
          id="welcome-preview"
          tabIndex={-1}
        >
          <WelcomePreview />
        </div>
      </section>
      <section
        className="margin-welcome-interlude"
        aria-labelledby="welcome-pace-title"
      >
        <div className="margin-welcome-interlude-copy">
          <h2 id="welcome-pace-title">
            <span>Life happens</span>
            <span>outside the feed.</span>
          </h2>
          <p>Catch up with your people. Then put your phone down.</p>
          <PublicTextLink href="/why-margin">
            A different kind of social
          </PublicTextLink>
        </div>
        <figure className="margin-welcome-outside">
          <Image
            src={lifeHappens}
            alt="A person walking along a quiet beach beneath misty cliffs."
            sizes="(max-width: 767px) 100vw, 55vw"
          />
          <figcaption>
            Nothing more to catch up on. Nowhere else to be.
          </figcaption>
        </figure>
      </section>
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
          <PublicTextLink href="/how-it-works">How Margin works</PublicTextLink>
        </div>
        <div className="margin-welcome-message-stage">
          <p className="margin-welcome-message-preface">
            A little later, in messages…
          </p>
          <WelcomeMessages />
          <p className="margin-welcome-message-afterword">
            And just like that, Saturday has plans.
          </p>
        </div>
      </section>
      <section
        className="margin-welcome-gallery-section"
        aria-labelledby="welcome-gallery-title"
      >
        <div className="margin-welcome-gallery-heading">
          <h2 id="welcome-gallery-title">
            The days move on.
            <br />
            Keep the good bits.
          </h2>
          <p>
            A small gallery of photographs, chosen by you. For the friends who
            know the stories behind them.
          </p>
        </div>
        <WelcomeGallery />
      </section>
      <section
        className="margin-welcome-joining"
        aria-labelledby="welcome-joining-title"
      >
        <div>
          <h2 id="welcome-joining-title">
            <span>For the people</span> <span>you think of first.</span>
          </h2>
          <p className="margin-welcome-invitation">
            Have someone in mind? Start with your invitation.
          </p>
          <PublicTextLink href="/sign-up">Join Margin</PublicTextLink>
        </div>
      </section>
    </>
  );
}
