import { Avatar } from "@/features/feed/post-content";
import { WelcomeMessageArrival } from "./welcome-message-arrival";

// Public illustration only; never reads member data.
const robin = {
  id: "public-robin",
  name: "Robin Lee",
  initials: "RL",
  tone: "sage" as const,
};

export function WelcomeMessages() {
  return (
    <figure
      id="welcome-preview"
      tabIndex={-1}
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
            <span>View profile</span>
          </div>
        </header>
        <div className="margin-welcome-message-history">
          <p className="margin-welcome-message-bubble">
            Coffee there this weekend?
          </p>
          <p className="margin-welcome-message-bubble" data-outgoing>
            Saturday? I’ll get us a table.
          </p>
          <WelcomeMessageArrival>
            <p className="margin-welcome-message-bubble margin-welcome-message-final">
              Ten o’clock. I’m buying.
            </p>
          </WelcomeMessageArrival>
        </div>
      </section>
    </figure>
  );
}
