/** Shareable addresses use a namespace so usernames cannot shadow public pages. */
export function sharedProfilePath(username: string) {
  return `/people/${encodeURIComponent(username.toLowerCase())}`;
}

/** Only a same-origin profile address may override the ordinary feed landing. */
export function profileSignInDestination(
  value: unknown,
  origin?: string | null,
) {
  if (typeof value !== "string") return "/app/feed";
  try {
    const base = origin ?? "https://margin.invalid";
    const url = new URL(value, base);
    if (
      url.origin !== new URL(base).origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/people\/[a-z][a-z0-9_]{2,23}$/i.test(url.pathname)
    )
      return "/app/feed";
    return url.pathname.toLowerCase();
  } catch {
    return "/app/feed";
  }
}
