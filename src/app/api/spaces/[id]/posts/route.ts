import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spacePosts", (await params).id);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spacePublish", (await params).id);
}
