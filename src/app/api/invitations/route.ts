import { invitationRequest } from "@/server/account/invitation-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return invitationRequest(request, "list");
}
export async function POST(request: Request) {
  return invitationRequest(request, "issue");
}
