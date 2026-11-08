import "server-only";
import { getSampleSpaces } from "@/fixtures/spaces";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentSpaces(
  ...args: Parameters<typeof getSampleSpaces>
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleSpaces(...args);
}
