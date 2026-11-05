import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "moderationReport", (await context.params).id);
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "moderationReview", (await context.params).id);
}
