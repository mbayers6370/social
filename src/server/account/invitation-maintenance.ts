import "server-only";
import type { InvitationProvider } from "./invitation-provider";

/** Standalone worker capability: read/revoke only, never send invitations. */
export function invitationMaintenanceProvider(): Pick<
  InvitationProvider,
  "find" | "revoke"
> {
  async function request(path: string, method = "GET") {
    if (!process.env.CLERK_SECRET_KEY)
      throw Error("Invitation provider is unavailable");
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Error("Provider reconciliation unavailable");
    return response.json();
  }
  return {
    find: async (query) =>
      (
        await request(
          `/invitations?query=${encodeURIComponent(query)}&limit=100`,
        )
      ).data.map(
        (item: {
          id: string;
          email_address: string;
          status: string;
          public_metadata: Record<string, unknown> | null;
        }) => ({
          id: item.id,
          emailAddress: item.email_address,
          status: item.status,
          publicMetadata: item.public_metadata,
        }),
      ),
    revoke: (id) =>
      request(`/invitations/${encodeURIComponent(id)}/revoke`, "POST"),
  };
}
