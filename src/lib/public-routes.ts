/** Exact public pages only. Never broaden this to arbitrary support/API prefixes. */
export const PUBLIC_PAGE_PATHS = [
  "/welcome",
  "/why-margin",
  "/how-it-works",
  "/join",
  "/help",
  "/contact",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/retention",
  "/copyright",
  "/cookies",
  "/accessibility",
  "/your-data",
] as const;
export const isPublicPage = (pathname: string) =>
  PUBLIC_PAGE_PATHS.some((path) => path === pathname);
