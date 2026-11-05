import "server-only";

/** Worker-only provider deletion. A 404 confirms an already-deleted identity;
 * timeouts, authorization failures and all other errors must be retried. */
export async function deleteClerkIdentity(subject: string) {
  if (!subject || !process.env.CLERK_SECRET_KEY)
    throw Error("Erasure provider unavailable");
  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(subject)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok && response.status !== 404)
    throw Error("Provider erasure needs retry");
}
