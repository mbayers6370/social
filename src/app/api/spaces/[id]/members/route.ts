import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spaceMember", (await params).id);
}
