import Image from "next/image";
import longWayRound from "@/assets/fixtures/long-way-round.jpg";
import { Avatar } from "@/features/feed/post-content";
import { WelcomeReveal } from "./welcome-reveal";
import { BrandBrackets } from "@/components/shared/brand-brackets";

// Deliberately public illustration. Never read an account, private post, or server fixture.
const alex = {
  id: "public-alex",
  name: "Alex Rowan",
  initials: "AR",
  tone: "paper" as const,
};
const robin = {
  id: "public-robin",
  name: "Robin Lee",
  initials: "RL",
  tone: "sage" as const,
};

export function WelcomePreview() {
  return (
    <WelcomeReveal>
      <div className="margin-welcome-example">
        <article aria-label="Fictional post by Alex Rowan">
          <header className="margin-welcome-author" data-welcome-step="author">
            <Avatar person={alex} />
            <div>
              <strong>{alex.name}</strong>
              <span>Sunday morning</span>
            </div>
          </header>
          <p className="margin-welcome-post-text" data-welcome-step="text">
            Stopped for coffee on the way home. Took a different route back.
          </p>
          <Image
            className="margin-welcome-photo"
            data-welcome-step="photo"
            src={longWayRound}
            alt="Sunlight falling across a cobbled street lined with cafés."
            sizes="(max-width: 639px) calc(100vw - 88px), (max-width: 1023px) 512px, (max-width: 1599px) 42vw, 640px"
            loading="eager"
            fetchPriority="high"
          />
          <section
            className="margin-welcome-conversation"
            data-welcome-step="conversation"
            aria-label="Illustrative conversation between friends"
          >
            <div className="margin-welcome-comment">
              <Avatar person={robin} small />
              <div>
                <strong>{robin.name}</strong>
                <p>Which coffee place was it?</p>
              </div>
            </div>
            <div className="margin-welcome-reply" data-welcome-step="reply">
              <strong>{alex.name}</strong>
              <p>The little one by the station.</p>
            </div>
          </section>
        </article>
        <p className="margin-welcome-caught-up" data-welcome-step="ending">
          <BrandBrackets>That’s everything for now.</BrandBrackets>
        </p>
      </div>
    </WelcomeReveal>
  );
}
