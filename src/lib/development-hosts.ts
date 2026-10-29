/** Exact local-device hosts belong in private environment configuration. */
export function getDevelopmentOrigins(
  source = process.env.MARGIN_DEV_ALLOWED_HOSTS,
): string[] {
  const hosts = (source ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  for (const host of hosts) {
    let parsed: URL;
    try {
      parsed = new URL(`http://${host}`);
    } catch {
      throw new Error("MARGIN_DEV_ALLOWED_HOSTS requires exact hostnames.");
    }
    if (
      host.includes("*") ||
      parsed.hostname !== host ||
      parsed.host !== host ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("MARGIN_DEV_ALLOWED_HOSTS requires exact hostnames.");
    }
  }
  return [...new Set(hosts)];
}
