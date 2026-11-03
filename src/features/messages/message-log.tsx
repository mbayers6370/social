import { dayKey, postTime } from "@/features/feed/format";
import { continuesMessageGroup } from "./format";
import type { PreviewMessage } from "./schema";
/** Shared readable day/speaker groups; messages are supplied by the caller. */
export function MessageLog({
  messages,
  notebook,
  name,
  referenceTime,
}: {
  messages: PreviewMessage[];
  notebook: boolean;
  name: string;
  referenceTime: string;
}) {
  const today = dayKey(referenceTime);
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
  return (
    <ol
      className="margin-message-log"
      aria-label={notebook ? "Notebook entries" : `Messages with ${name}`}
    >
      {messages.map((message, index) => {
        const date = dayKey(message.createdAt);
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const showTime = !next || !continuesMessageGroup(message, next);
        return (
          <li
            key={message.id}
            className="margin-message-row"
            data-direction={notebook ? "outgoing" : message.direction}
            data-group-start={!continuesMessageGroup(previous, message)}
          >
            {(!previous || dayKey(previous.createdAt) !== date) && (
              <h3 className="margin-message-day">
                {date === today
                  ? "Today"
                  : date === yesterday
                    ? "Yesterday"
                    : new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "long",
                        timeZone: "America/Los_Angeles",
                      }).format(new Date(message.createdAt))}
              </h3>
            )}
            <p className="margin-message-bubble">
              <span className="sr-only">
                {message.direction === "outgoing" ? "You" : name}:{" "}
              </span>
              {message.body}
            </p>
            {showTime && (
              <time dateTime={message.createdAt}>
                {postTime(message.createdAt)}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
