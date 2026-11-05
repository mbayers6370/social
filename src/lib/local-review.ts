type Environment = Record<string, string | undefined>;

/** Keep review artifacts out of the standard `.next` build used by `next start`. */
export const localReviewBuildDirectory = ".local/local-review/next";

export function nextBuildDirectory(
  environment: Environment,
): string | undefined {
  return environment.MARGIN_LOCAL_REVIEW === "1"
    ? localReviewBuildDirectory
    : undefined;
}

function isPrivateHost(hostname: string): boolean {
  if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return true;
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
}

function isSafeReviewOrigin(source: string | undefined): boolean {
  try {
    const url = new URL(source ?? "");
    return Boolean(
      (url.protocol === "https:" ||
        (url.protocol === "http:" && url.hostname === "localhost")) &&
      isPrivateHost(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    );
  } catch {
    return false;
  }
}

function isKnownLocalDatabase(source: string | undefined): boolean {
  try {
    const url = new URL(source ?? "");
    return Boolean(
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname === "127.0.0.1" &&
      url.port === "55432" &&
      url.pathname === "/margin_local" &&
      url.username === "margin_runtime",
    );
  } catch {
    return false;
  }
}

/**
 * A production-optimized local review may use development providers without
 * weakening a hosted production deployment. Every condition is required.
 */
export function isLocalReviewConfiguration(environment: Environment): boolean {
  return Boolean(
    environment.MARGIN_LOCAL_REVIEW === "1" &&
    environment.NODE_ENV === "production" &&
    environment.CI !== "true" &&
    environment.MARGIN_LOCAL_PHOTO_STORE === "1" &&
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") &&
    environment.CLERK_SECRET_KEY?.startsWith("sk_test_") &&
    isSafeReviewOrigin(environment.NEXT_PUBLIC_APP_URL) &&
    isKnownLocalDatabase(environment.DATABASE_URL),
  );
}
