import "server-only";
import { getSampleFeed } from "@/fixtures/feed";
export { imageData } from "@/fixtures/feed";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentFeed(...args: Parameters<typeof getSampleFeed>) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleFeed(...args);
}
