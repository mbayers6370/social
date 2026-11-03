import { invitationRequest } from "@/server/account/invitation-http";
export const runtime = "nodejs";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return invitationRequest(request, "revoke", (await params).id);
}
