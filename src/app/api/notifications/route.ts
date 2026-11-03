import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return memberRequest(request, "notifications");
}
export async function PUT(request: Request) {
  return memberRequest(request, "notificationsRead");
}
