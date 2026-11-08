import "server-only";
import { getSampleScreens } from "@/fixtures/screens";

/** Development access remains unavailable in production. Sample data is shared with the isolated portfolio build. */
export function getDevelopmentScreens(
  ...args: Parameters<typeof getSampleScreens>
) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  return getSampleScreens(...args);
}
