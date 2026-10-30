import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return socialRequest(request, "account");
}
export async function DELETE(request: Request) {
  return socialRequest(request, "deactivate");
}
