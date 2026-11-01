import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "readPhoto", (await context.params).id);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "deletePhoto", (await context.params).id);
}
