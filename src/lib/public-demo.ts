/** Set only by the separate portfolio Next.js configuration. Never an authorization flag. */
export const publicDemo = process.env.NEXT_PUBLIC_MARGIN_DEMO === "1";

/** Keep shared preview navigation within the public demo without changing member destinations. */
export function previewHref(href: string) {
  if (!publicDemo || !href.startsWith("/")) return href;
  const url = new URL(href, "https://demo.invalid");
  if (
    url.pathname === "/" ||
    url.pathname === "/app" ||
    url.pathname === "/app/feed"
  ) {
    if (url.pathname === "/app" && !url.searchParams.has("view"))
      url.searchParams.set("view", "profile");
    return `/demo/${url.search}${url.hash}`;
  }
  if (
    url.pathname === "/preview/spaces" ||
    url.pathname === "/app/spaces" ||
    url.pathname.startsWith("/app/spaces/")
  ) {
    url.searchParams.set("view", "spaces");
    const id = url.pathname.split("/")[3];
    if (id) url.searchParams.set("space", id);
    return `/demo/${url.search}${url.hash}`;
  }
  const memberView = /^\/app\/(messages|gallery|friends|settings)$/.exec(
    url.pathname,
  )?.[1];
  if (memberView) {
    url.searchParams.set("view", memberView);
    return `/demo/${url.search}${url.hash}`;
  }
  if (url.pathname.startsWith("/people/"))
    return `/demo/?view=profile&person=${encodeURIComponent(decodeURIComponent(url.pathname.slice(8)))}`;
  return href;
}
