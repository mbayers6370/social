import { createLocalId } from "@/lib/local-id";

const previewKey = "margin.preview-login";
const entranceKey = "margin.brand-entrance";
const played = new Set<string>();
let memoryPreviewId: string | null = null;

/** Cosmetic session markers only; these never authorize account access. */
export function previewLoginId() {
  try {
    const existing = sessionStorage.getItem(previewKey);
    if (existing) return existing;
  } catch {
    /* In-memory preview remains usable when browser storage is blocked. */
  }
  const id = memoryPreviewId ?? `preview-${createLocalId()}`;
  memoryPreviewId = id;
  try {
    sessionStorage.setItem(previewKey, id);
  } catch {
    /* Use the tab's memory. */
  }
  return id;
}
export function endPreviewLogin() {
  memoryPreviewId = null;
  try {
    sessionStorage.removeItem(previewKey);
  } catch {
    /* No stored marker to clear. */
  }
}
export function claimBrandEntrance(loginId: string) {
  if (played.has(loginId)) return false;
  played.add(loginId);
  try {
    if (localStorage.getItem(entranceKey) === loginId) return false;
    // One current login marker also coordinates navigation, reloads and tabs.
    localStorage.setItem(entranceKey, loginId);
  } catch {
    /* The module-level marker still prevents repeats during navigation. */
  }
  return true;
}
