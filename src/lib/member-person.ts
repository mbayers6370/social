import { portraitCropVersion } from "./portrait-crop";
import type { Person } from "@/features/feed/schema";
export function memberPerson(
  id: string,
  account: {
    displayName: string;
    portraitPhotoId?: string | null;
    portraitCrop?: unknown;
  },
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
            src: `/api/profiles/${encodeURIComponent(id)}/portrait?v=${encodeURIComponent(account.portraitPhotoId + portraitCropVersion(account.portraitCrop))}`,
            width: 208,
            height: 208,
          },
        }
      : {}),
  };
}
