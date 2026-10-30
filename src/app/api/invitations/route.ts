import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return socialRequest(request, "createInvitation");
}
