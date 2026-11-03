import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return memberRequest(request, "postPublish");
}
