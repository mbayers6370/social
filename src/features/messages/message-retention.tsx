import type { ReactNode } from "react";
import {
  MESSAGE_LIFETIME_DAYS,
  NOTEBOOK_LIFETIME_DAYS,
} from "@/lib/message-policy";

export function MessageRetention({
  notebook = false,
  exportAction,
}: {
  notebook?: boolean;
  exportAction?: ReactNode;
}) {
  return (
    <p className="margin-message-retention">
      <span id="message-retention">
        {notebook
          ? `Notes expire ${NOTEBOOK_LIFETIME_DAYS} days after saving.`
          : `Messages expire ${MESSAGE_LIFETIME_DAYS} days after sending.`}
      </span>
      {!notebook && exportAction && <> {exportAction}</>}
    </p>
  );
}
