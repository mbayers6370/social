import "server-only";

/** Credential-free public shell. Authenticated deployments use Clerk's nonce/CSP integration. */
export function createContentSecurityPolicy(
  nonce: string,
  development: boolean,
) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  const sentryOrigin = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin
    : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${development ? "ws: " : ""}${sentryOrigin}`.trim(),
    "object-src 'none'",
    "media-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
