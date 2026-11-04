import { createServer } from "node:net";

/** Only disposable test credentials are added after this credential-free base. */
export function isolatedEnvironment(source, example = "") {
  const env = { ...source };
  const configured = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
    (m) => m[1],
  );
  for (const key of configured) env[key] = "";
  for (const key of Object.keys(env)) {
    if (
      /^(?:CLERK_|NEXT_PUBLIC_CLERK_|UPSTASH_|R2_|AWS_|SENTRY_|NEXT_PUBLIC_SENTRY_|TICKETMASTER_|INVITATION_)/.test(
        key,
      ) ||
      /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)$/.test(key) ||
      /^(?:DATABASE_URL|MIGRATION_DATABASE_URL|RUN_(?:LIVE_|LOCAL_DB|PRIVATE_DB)|PLAYWRIGHT_)/.test(
        key,
      )
    )
      delete env[key];
  }
  return env;
}

/** Independent verification runs never compete with the user's app or each other. */
export function localTestPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
