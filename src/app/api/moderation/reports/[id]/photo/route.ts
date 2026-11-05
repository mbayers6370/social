import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "moderationPhoto", (await context.params).id);
}
