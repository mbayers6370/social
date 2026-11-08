import "server-only";
import { getSampleNotifications } from "@/fixtures/notifications";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentNotifications(
  ...args: Parameters<typeof getSampleNotifications>
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleNotifications(...args);
}
