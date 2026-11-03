import type { Person } from "@/features/feed/schema";
export function memberPerson(
  id: string,
  account: { displayName: string; portraitPhotoId?: string | null },
): Person {
  return {
    id,
    name: account.displayName,
    initials: account.displayName
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase(),
    tone: "paper",
    ...(account.portraitPhotoId
      ? {
          photo: {
            src: `/api/profiles/${encodeURIComponent(id)}/portrait?v=${encodeURIComponent(account.portraitPhotoId)}`,
            width: 208,
            height: 208,
          },
        }
      : {}),
  };
}
