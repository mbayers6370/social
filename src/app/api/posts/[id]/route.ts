import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "readPost", (await context.params).id);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "deletePost", (await context.params).id);
}
