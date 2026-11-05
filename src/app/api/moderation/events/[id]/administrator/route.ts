import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "eventAdmin", (await context.params).id);
}
