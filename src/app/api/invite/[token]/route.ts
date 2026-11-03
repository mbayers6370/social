import { invitationRequest } from "@/server/account/invitation-http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return invitationRequest(request, "email", (await params).token);
}
