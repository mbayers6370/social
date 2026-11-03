import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  return memberRequest(request, "preferences");
}
