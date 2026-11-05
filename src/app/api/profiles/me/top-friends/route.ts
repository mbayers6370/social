import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return memberRequest(request, "topFriends");
}
export async function PUT(request: Request) {
  return memberRequest(request, "topFriendsUpdate");
}
