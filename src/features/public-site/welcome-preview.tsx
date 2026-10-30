import Image from "next/image";
import { Mail } from "lucide-react";
import coffeeShop from "@/assets/fixtures/coffee-shop.jpg";
import { Avatar } from "@/features/feed/post-content";
import { WelcomeReveal } from "./welcome-reveal";
import { WelcomePost } from "./welcome-interactive";
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
        <div className="margin-welcome-feed-chrome">
          <BrandBrackets>
            <span className="margin-brand-name">margin</span>
          </BrandBrackets>
        </div>
        <div className="margin-welcome-feed-content">
          <div className="margin-welcome-example-label">
            <span>Your feed</span>
            <span>Newest First</span>
          </div>
          <WelcomePost
            discussion={
              <section
                className="margin-welcome-conversation"
                aria-label="Conversation between friends"
              >
                <div className="margin-welcome-comment">
                  <Avatar person={robin} small />
                  <div>
                    <strong>{robin.name}</strong>
                    <p>This looks lovely. Where is it?</p>
                  </div>
                </div>
                <div className="margin-welcome-reply">
                  <strong>{alex.name}</strong>
                  <p>The little place by the station. You’d love it.</p>
                </div>
              </section>
            }
          >
            <header className="margin-welcome-author">
              <Avatar person={alex} />
              <div>
                <strong>{alex.name}</strong>
                <span>Sunday morning</span>
              </div>
            </header>

            <Image
              className="margin-welcome-photo"
              src={coffeeShop}
              alt="Plants and warm pendant lights beside a coffee shop window overlooking the street."
              sizes="(max-width: 639px) calc(100vw - 112px), (max-width: 1023px) 500px, (max-width: 1439px) calc(50vw - 152px), 500px"
              loading="eager"
              fetchPriority="high"
            />
            <p className="margin-welcome-post-text">
              Found a little place worth taking the long way for.
            </p>
          </WelcomePost>
          <p className="margin-welcome-caught-up">
            <BrandBrackets>That’s everything for now.</BrandBrackets>
            <span>Go enjoy the rest of your day.</span>
          </p>
        </div>
      </div>
    </WelcomeReveal>
  );
}

export function WelcomeMessages() {
  return (
    <figure
      className="margin-welcome-messages"
      aria-label="Messages between friends"
    >
      <section
        className="margin-welcome-message-thread"
        aria-label="Messages with Robin Lee"
      >
        <header>
          <Avatar person={robin} />
          <div>
            <strong>{robin.name}</strong>
            <span>Messages</span>
          </div>
          <Mail aria-hidden="true" />
        </header>
        <div className="margin-welcome-message-history">
          <p className="margin-welcome-message-date">A few minutes later</p>
          <p className="margin-welcome-message-bubble">
            Coffee there this weekend?
          </p>
          <p className="margin-welcome-message-bubble" data-outgoing>
            Saturday? I’ll get us a table.
          </p>
          <p className="margin-welcome-message-bubble">
            Ten o’clock. I’m buying.
          </p>
          <span className="margin-welcome-message-time">10:14 am</span>
        </div>
      </section>
    </figure>
  );
}
