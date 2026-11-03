import {
  MESSAGE_LIFETIME_DAYS,
  NOTEBOOK_LIFETIME_DAYS,
} from "@/lib/message-policy";

export function MessageRetention({ notebook = false }: { notebook?: boolean }) {
  return (
    <p id="message-retention" className="margin-message-retention">
      {notebook
        ? `Notes are intended to expire ${NOTEBOOK_LIFETIME_DAYS} days after saving.`
        : `Messages are intended to expire ${MESSAGE_LIFETIME_DAYS} days after sending.`}
    </p>
  );
}
