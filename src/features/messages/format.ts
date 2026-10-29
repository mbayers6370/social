import { dayKey } from "@/features/feed/format";
import type { PreviewMessage } from "./schema";

/** A short exchange from one speaker, within the same local calendar day. */
export function continuesMessageGroup(
  previous: PreviewMessage | undefined,
  current: PreviewMessage,
) {
  if (!previous || previous.direction !== current.direction) return false;
  const elapsed =
    Date.parse(current.createdAt) - Date.parse(previous.createdAt);
  return (
    elapsed >= 0 &&
    elapsed <= 5 * 60_000 &&
    dayKey(previous.createdAt) === dayKey(current.createdAt)
  );
}
