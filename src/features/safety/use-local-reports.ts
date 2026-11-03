"use client";
import { usePreview } from "@/features/local-preview/provider";
import { useOptionalSpacesPreview } from "@/features/spaces/preview-provider";

/** Both local audiences keep their validation and storage in their own providers. */
export function useLocalReports() {
  const preview = usePreview();
  const spaces = useOptionalSpacesPreview();
  return [...preview.reports, ...(spaces?.reports ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
