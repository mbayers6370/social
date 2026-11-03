import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "profile", (await params).id);
}
