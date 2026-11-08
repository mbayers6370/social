import "server-only";
import { getSampleNadiaContent } from "@/fixtures/nadia";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentNadiaContent(
  ...args: Parameters<typeof getSampleNadiaContent>
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleNadiaContent(...args);
}
