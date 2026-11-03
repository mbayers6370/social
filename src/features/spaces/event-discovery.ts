import { z } from "zod";
import type { SpaceSummary } from "./contracts";

export const eventSearchInput = z.string().trim().max(100);
export const normalizeEventText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export function eventSearchWords(query: string) {
  return normalizeEventText(query).split(" ").filter(Boolean);
}

export function matchesEventSearch(space: SpaceSummary, query: string) {
  const text = normalizeEventText(`${space.name} ${space.location ?? ""}`);
  return eventSearchWords(query).every((word) => text.includes(word));
}
