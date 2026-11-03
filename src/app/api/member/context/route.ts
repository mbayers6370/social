import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return memberRequest(request, "identity");
}
