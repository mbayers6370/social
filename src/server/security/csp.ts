import "server-only";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
function isLocalHttp(url: URL) {
  return url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

/** Credential-free public shell. Authenticated deployments use Clerk's nonce/CSP integration. */
export function createContentSecurityPolicy(
  nonce: string,
  development: boolean,
  requestUrl?: URL,
) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  // Safari upgrades localhost assets too. Permit HTTP only when both this
  // request and the explicitly configured application origin are loopback HTTP.
  let localHttp = false;
  if (requestUrl && isLocalHttp(requestUrl)) {
    try {
      localHttp = isLocalHttp(new URL(process.env.NEXT_PUBLIC_APP_URL ?? ""));
    } catch {
      // Missing or invalid configuration retains the production policy.
    }
  }
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
    ...(!development && !localHttp ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
