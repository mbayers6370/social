import "server-only";
import { getSampleSocial } from "@/fixtures/social";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentSocial(
  ...args: Parameters<typeof getSampleSocial>
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleSocial(...args);
}
