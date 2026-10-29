import { format, parseISO } from "date-fns";

/** Date-only ISO values, avoiding implicit device timezone shifts. Pass a locale when needed. */
export function formatCalendarDate(value: string) {
  return format(parseISO(value), "MMM d, yyyy");
}
