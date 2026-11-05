import { dayKey, postTime, FEED_TIME_ZONE } from "@/features/feed/format";
import { NOTEBOOK_LIFETIME_DAYS } from "@/lib/message-policy";
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
      data-notebook={notebook || undefined}
      aria-label={notebook ? "Notebook entries" : `Messages with ${name}`}
    >
      {messages.map((message, index) => {
        if (notebook) {
          const startsDay =
            index === 0 ||
            dayKey(messages[index - 1].createdAt) !== dayKey(message.createdAt);
          const expiresAt = new Date(
            Date.parse(message.createdAt) + NOTEBOOK_LIFETIME_DAYS * 86_400_000,
          );
          return (
            <li
              key={message.id}
              className="margin-notebook-entry"
              data-day-start={(index > 0 && startsDay) || undefined}
            >
              {startsDay && (
                <div className="margin-notebook-meta">
                  <time
                    className="margin-notebook-date"
                    dateTime={message.createdAt}
                  >
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: FEED_TIME_ZONE,
                    }).format(new Date(message.createdAt))}
                  </time>{" "}
                  <span className="margin-notebook-expiry">
                    <span aria-hidden="true">{"//"}</span> expires{" "}
                    <time dateTime={expiresAt.toISOString()}>
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: FEED_TIME_ZONE,
                      }).format(expiresAt)}
                    </time>
                  </span>
                </div>
              )}
              <p className="margin-notebook-body">{message.body}</p>
            </li>
          );
        }
        const date = dayKey(message.createdAt);
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const showTime = !next || !continuesMessageGroup(message, next);
        return (
          <li
            key={message.id}
            className="margin-message-row"
            data-direction={message.direction}
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
