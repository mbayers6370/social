"use server";

import { getDevelopmentNadiaContent } from "./nadia";

/** Only returns fictional local-demo data. Never authenticates or changes a real friendship. */
export async function loadDevelopmentFriendProfile(personId: string) {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Development fixtures are unavailable");
  if (personId !== "nadia") return null;
  return getDevelopmentNadiaContent();
}
