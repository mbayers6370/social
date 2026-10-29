import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PublicTextLink } from "./public-shell";
import { WelcomePreview } from "./welcome-preview";
import { MINIMUM_AGE } from "@/lib/platform-rules";
import { publicSiteDetails } from "./site-details";

export function PublicHome() {
  return (
    <>
      <section className="margin-public-hero" aria-labelledby="public-title">
        <div className="margin-welcome-copy">
          <p className="margin-public-kicker">A social space for friends.</p>
          <h1 id="public-title">
            A little less.
            <br />A little closer.
          </h1>
          <p className="margin-public-intro">
            Share a thought, a photograph, a little of your day. Catch up with
            your people, then get back to living.
          </p>
          <div className="margin-welcome-actions">
            <Link
              href="/join"
              aria-describedby="welcome-join-status"
              className={buttonVariants({ className: "margin-welcome-cta" })}
            >
              {publicSiteDetails.joiningLabel}
            </Link>
            <PublicTextLink href="/how-it-works">How it works</PublicTextLink>
          </div>
          <p id="welcome-join-status" className="margin-public-status">
            In development. Registration isn’t open yet.
            <br />
            For people {MINIMUM_AGE} and over.
          </p>
        </div>
        <WelcomePreview />
      </section>
      <div className="margin-welcome-principles">
        <section
          className="margin-welcome-moment"
          aria-labelledby="welcome-friends-title"
        >
          <p className="margin-welcome-topic">The feed</p>
          <h2 id="welcome-friends-title">
            Your people,
            <br />
            newest first.
          </h2>
          <p>A chronological feed from the friends you’ve chosen.</p>
          <PublicTextLink href="/how-it-works#friends">
            How friendship works
          </PublicTextLink>
        </section>
        <section
          className="margin-welcome-moment"
          aria-labelledby="welcome-allowance-title"
        >
          <p className="margin-welcome-topic">The pace</p>
          <h2 id="welcome-allowance-title">
            A little room
            <br />
            each day.
          </h2>
          <p>Share a few moments. Leave room for living them.</p>
          <PublicTextLink href="/how-it-works#posting">
            The daily allowance
          </PublicTextLink>
        </section>
        <section
          className="margin-welcome-moment"
          aria-labelledby="welcome-gallery-title"
        >
          <p className="margin-welcome-topic">What remains</p>
          <h2 id="welcome-gallery-title">
            Keep what
            <br />
            matters.
          </h2>
          <p>
            Posts are designed to fade after 30 days. Your gallery holds the
            photographs you choose to keep.
          </p>
          <PublicTextLink href="/how-it-works#gallery">
            How the gallery works
          </PublicTextLink>
        </section>
      </div>
      <section
        className="margin-public-closing"
        aria-labelledby="welcome-closing-title"
      >
        <h2 id="welcome-closing-title">
          A place to catch up.
          <br />
          Then carry on.
        </h2>
      </section>
    </>
  );
}
