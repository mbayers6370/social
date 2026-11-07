/** Exact public pages only. Never broaden this to arbitrary support/API prefixes. */
export const PUBLIC_PAGE_PATHS = [
  "/welcome",
  "/sign-in",
  "/sign-up",
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

/** Anonymous public-site submission only; private account APIs remain protected. */
export const isPublicSubmission = (pathname: string) =>
  pathname === "/api/waitlist";

/** Shared exact allowlist for authentication and country access; no asset suffix exemptions. */
const PUBLIC_ASSET_PATHS = [
  "/icon",
  "/apple-icon",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/brand/margin-email.png",
  "/brands/apple-music.svg",
  "/brands/spotify.svg",
  "/brands/itunes-store.svg",
  "/brands/photo-open-cursor.svg",
  "/fonts/NotoSans-Regular.ttf",
  "/fonts/OFL.txt",
] as const;
export const isPublicAsset = (pathname: string) =>
  PUBLIC_ASSET_PATHS.some((path) => path === pathname);
