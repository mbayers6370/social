import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import type { InvitationProvider } from "./invitation-provider";
export async function clerkInvitationProvider(): Promise<InvitationProvider> {
  const client = await clerkClient();
  return {
    find: async (query) =>
      (await client.invitations.getInvitationList({ query, limit: 100 })).data,
    create: (emailAddress, redirectUrl, claimId) =>
      client.invitations.createInvitation({
        emailAddress,
        redirectUrl,
        expiresInDays: 30,
        ignoreExisting: false,
        notify: true,
        publicMetadata: { marginInvitationId: claimId },
      }),
    revoke: (id) => client.invitations.revokeInvitation(id),
  };
}
