import "server-only";

/** One fail-closed configuration boundary for pages, proxy and server actions. */
export function accountConfiguration() {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  const production = process.env.NODE_ENV === "production";
  let origin: string | null = null;
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_APP_URL ||
        (production ? "" : "http://localhost:3000"),
    );
    if (
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" || (!production && url.protocol === "http:"))
    )
      origin = url.origin;
  } catch {
    /* Invalid origins never authorize an authentication deployment. */
  }
  const kind = publishable.match(/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/)?.[1];
  const configured = Boolean(
    origin &&
    kind &&
    secret.startsWith(`sk_${kind}_`) &&
    (!production || kind === "live"),
  );
  return {
    configured,
    origin,
    registrationEnabled:
      configured && process.env.MARGIN_REGISTRATION_ENABLED === "1",
  };
}
